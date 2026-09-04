// Watchdog for the AI grading queue.
//
// Runs on a schedule (cron job 'grading-queue-alert', every 10 minutes) and
// emails the admin when submissions are sitting in the queue too long:
//   • pending jobs created more than 10 minutes ago that were never claimed
//   • processing jobs claimed more than 10 minutes ago (worker died mid-run)
//
// At most ONE email per 60 minutes — throttling is derived from
// public.email_send_log (template_name = 'grading-queue-alert'), so no extra
// state table is needed and a redeploy can never reset the throttle.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "khanhthien4698@gmail.com";
const LABEL = "grading-queue-alert";
const STALE_MINUTES = 10;
const THROTTLE_MINUTES = 60;

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

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60_000));
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal callers only: the cron shared secret or a service_role JWT.
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

  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

    const [stuckPendingRes, stuckProcessingRes] = await Promise.all([
      admin
        .from("grading_jobs")
        .select("id, skill, part, created_at")
        .eq("status", "pending")
        .is("claimed_at", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(500),
      admin
        .from("grading_jobs")
        .select("id, skill, part, claimed_at")
        .eq("status", "processing")
        .lt("claimed_at", cutoff)
        .order("claimed_at", { ascending: true })
        .limit(500),
    ]);

    const pending = (stuckPendingRes.data || []) as any[];
    const processing = (stuckProcessingRes.data || []) as any[];
    const total = pending.length + processing.length;

    if (total === 0) {
      return json({ alerted: false, reason: "queue_healthy", pending: 0, processing: 0 });
    }

    const waits = [
      ...pending.map((j) => minutesSince(j.created_at)),
      ...processing.map((j) => minutesSince(j.claimed_at)),
    ];
    const maxWait = waits.length ? Math.max(...waits) : 0;

    // Throttle: one email per hour, even if the queue stays broken.
    const throttleFrom = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString();
    const { data: recent } = await admin
      .from("email_send_log")
      .select("id, created_at")
      .eq("template_name", LABEL)
      .eq("status", "sent")
      .gt("created_at", throttleFrom)
      .limit(1);
    if (recent && recent.length > 0) {
      return json({
        alerted: false,
        reason: "throttled",
        pending: pending.length,
        processing: processing.length,
        maxWaitMinutes: maxWait,
      });
    }

    const bySkill: Record<string, number> = {};
    for (const j of [...pending, ...processing]) {
      const k = `${j.skill ?? "?"}${j.part ? ` · ${j.part}` : ""}`;
      bySkill[k] = (bySkill[k] || 0) + 1;
    }
    const breakdown = Object.entries(bySkill)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<li>${k}: <strong>${n}</strong> bài</li>`)
      .join("");

    const subject = `[Aptis Kỳ Tích] ${total} bài chấm AI đang bị nghẽn (chờ tới ${formatDuration(maxWait)})`;
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6">
<h2 style="color:#CC1C01;margin:0 0 12px">Hàng đợi chấm AI đang bị nghẽn</h2>
<p>Hệ thống phát hiện <strong>${total}</strong> bài chưa được chấm quá ${STALE_MINUTES} phút.</p>
<ul>
  <li>Đang chờ chưa ai xử lý: <strong>${pending.length}</strong> bài</li>
  <li>Đang xử lý nhưng bị treo: <strong>${processing.length}</strong> bài</li>
  <li>Thời gian chờ lâu nhất: <strong>${formatDuration(maxWait)}</strong></li>
</ul>
${breakdown ? `<p>Chi tiết theo kỹ năng:</p><ul>${breakdown}</ul>` : ""}
<p style="color:#666;font-size:13px">Email này chỉ được gửi tối đa 1 lần mỗi ${THROTTLE_MINUTES} phút.</p>
</body></html>`;
    const text = `Hàng đợi chấm AI đang bị nghẽn.
Tổng: ${total} bài chưa chấm quá ${STALE_MINUTES} phút.
Đang chờ: ${pending.length} bài. Đang xử lý bị treo: ${processing.length} bài.
Chờ lâu nhất: ${formatDuration(maxWait)}.`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-app-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        to: ADMIN_EMAIL,
        subject,
        html,
        text,
        label: LABEL,
        idempotency_key: `${LABEL}-${new Date().toISOString().slice(0, 13)}`,
      }),
    });
    const sendBody = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[grading-queue-alert] send failed", res.status, JSON.stringify(sendBody));
      return json({ alerted: false, reason: "send_failed", status: res.status }, 502);
    }

    return json({
      alerted: true,
      pending: pending.length,
      processing: processing.length,
      maxWaitMinutes: maxWait,
      send: sendBody,
    });
  } catch (e: any) {
    console.error("[grading-queue-alert] fatal", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
