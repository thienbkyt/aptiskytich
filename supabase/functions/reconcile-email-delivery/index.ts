// Reconciles Lovable's real delivery events into public.email_send_log.
//
// Why this exists: the app only knows that the email API ACCEPTED a send. When
// the provider later refuses the message (e.g. sender domain unverified), the
// app row stays 'sent' forever and the failure is invisible. This function
// pulls the platform delivery events (rejected / bounced / complained /
// suppressed / rate_limited) and rewrites the matching app rows so a broken
// email path shows up within minutes instead of a day.
//
// Runs on a schedule (cron 'reconcile-email-delivery', every 5 minutes).

import { createClient } from "npm:@supabase/supabase-js@2";
import { listEmailLogs } from "npm:@lovable.dev/email-js@0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOOKBACK_MINUTES = 60;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Delivery event type -> the status the app row should carry.
const STATUS_MAP: Record<string, string> = {
  rejected: "failed",
  bounced: "bounced",
  complained: "complained",
  suppressed: "suppressed",
  rate_limited: "failed",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("GRADING_CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && cronHeader === cronSecret;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    const claims = authHeader?.startsWith("Bearer ")
      ? parseJwtClaims(authHeader.slice("Bearer ".length).trim())
      : null;
    if (claims?.role !== "service_role") return json({ error: "Unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "email_not_configured" }, 500);

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();

  const events: Array<{
    timestamp: string;
    recipient: string;
    event_type: string;
    status?: string;
    message_id?: string;
  }> = [];

  try {
    for (const eventType of Object.keys(STATUS_MAP)) {
      let cursor: string | undefined;
      for (let page = 0; page < 5; page++) {
        const res = await listEmailLogs(
          { event_type: eventType, since, limit: 100, cursor },
          { apiKey },
        );
        events.push(...(res.data ?? []) as typeof events);
        if (!res.pagination?.has_more || !res.pagination?.next_cursor) break;
        cursor = res.pagination.next_cursor;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Failed to read platform delivery events", msg);
    return json({ error: "delivery_logs_unavailable", message: msg }, 502);
  }

  let updated = 0;
  let inserted = 0;
  const failureReasons = new Map<string, number>();

  for (const ev of events) {
    const recipient = String(ev.recipient ?? "").toLowerCase();
    if (!recipient) continue;
    const newStatus = STATUS_MAP[ev.event_type] ?? "failed";
    const reason = `${ev.event_type}: ${ev.status ?? "no status"}`.slice(0, 1000);
    if (newStatus === "failed") {
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
    }

    // Match the app row this event belongs to: same recipient, still recorded
    // as accepted ('sent' or 'pending'), created shortly before the event.
    const windowStart = new Date(Date.parse(ev.timestamp) - 30 * 60_000).toISOString();
    const windowEnd = new Date(Date.parse(ev.timestamp) + 5 * 60_000).toISOString();

    const { data: candidates, error: findError } = await admin
      .from("email_send_log")
      .select("id, metadata")
      .eq("recipient_email", recipient)
      .in("status", ["sent", "pending"])
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      console.error("Lookup failed while reconciling delivery event", {
        code: findError.code,
        message: findError.message,
      });
      continue;
    }

    const row = candidates?.[0];
    if (row) {
      const { error: updateError } = await admin
        .from("email_send_log")
        .update({
          status: newStatus,
          error_message: reason,
          metadata: {
            ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
            delivery_event: ev.event_type,
            delivery_event_at: ev.timestamp,
            reconciled_at: new Date().toISOString(),
          },
        })
        .eq("id", row.id);
      if (updateError) {
        console.error("Failed to update reconciled row", {
          code: updateError.code,
          message: updateError.message,
        });
        continue;
      }
      updated++;
      continue;
    }

    // No app row matched (e.g. an auth email sent before logging existed):
    // record the outcome so the failure is still visible, once per event.
    const { data: existing } = await admin
      .from("email_send_log")
      .select("id")
      .eq("recipient_email", recipient)
      .eq("status", newStatus)
      .contains("metadata", { delivery_event_at: ev.timestamp })
      .limit(1);
    if (existing?.length) continue;

    const { error: insertError } = await admin.from("email_send_log").insert({
      template_name: "system",
      recipient_email: recipient,
      status: newStatus,
      message_id: ev.message_id ?? null,
      error_message: reason,
      metadata: { delivery_event: ev.event_type, delivery_event_at: ev.timestamp },
    });
    if (insertError) {
      console.error("Failed to insert reconciled row", {
        code: insertError.code,
        message: insertError.message,
      });
      continue;
    }
    inserted++;
  }

  const topReasons = [...failureReasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${count}x ${reason}`);

  if (topReasons.length) {
    console.error("Email delivery failures detected", { since, topReasons });
  }

  return json({
    since,
    events: events.length,
    updated,
    inserted,
    failures: topReasons,
  });
});
