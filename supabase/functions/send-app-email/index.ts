import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EmailAPIError, sendLovableEmail } from "npm:@lovable.dev/email-js@0.1.0";

// Server-only sender for emails composed inside the database (payment
// reminders, subscription notices). The database calls this function with a
// fully composed subject/html/text payload; delivery, retries, suppression and
// the unsubscribe footer are handled by Lovable's managed email API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_NAME = "Aptis Kỳ Tích";
const SENDER_DOMAIN = "notify.aptiskytich.vn";
const FROM_DOMAIN = "aptiskytich.vn";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function logSend(
  templateName: string,
  recipient: string,
  status: "sent" | "suppressed" | "failed",
  messageId?: string | null,
  errorMessage?: string,
) {
  const { error } = await admin.from("email_send_log").insert({
    template_name: templateName,
    recipient_email: recipient,
    status,
    message_id: messageId ?? null,
    error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
  });
  if (error) {
    console.error("Failed to write email_send_log row", {
      code: error.code,
      message: error.message,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Only the database (service role key) may trigger these sends.
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return json({ error: "email_not_configured" }, 500);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const to = String(body?.to ?? "").trim().toLowerCase();
  const subject = String(body?.subject ?? "").trim();
  const html = typeof body?.html === "string" ? body.html : "";
  const text = typeof body?.text === "string" ? body.text : "";
  const label = String(body?.label ?? "system").slice(0, 100);
  const messageId = body?.message_id ? String(body.message_id).slice(0, 200) : null;
  const idempotencyKey = String(body?.idempotency_key ?? messageId ?? crypto.randomUUID());

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || to.length > 320) {
    return json({ error: "invalid_recipient" }, 400);
  }
  if (!subject || subject.length > 300 || !html || html.length > 200_000) {
    return json({ error: "invalid_content" }, 400);
  }

  let attempt = 0;
  while (true) {
    try {
      await sendLovableEmail(
        {
          to,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text: text || subject,
          purpose: "transactional",
          label,
          idempotency_key: idempotencyKey,
        },
        { apiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") },
      );
      await logSend(label, to, "sent", messageId);
      return json({ sent: true });
    } catch (error) {
      if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
        await logSend(label, to, "suppressed", messageId, "Recipient suppressed");
        return json({ sent: false, reason: "recipient_suppressed" });
      }
      if (error instanceof EmailAPIError && error.status === 429 && attempt === 0) {
        attempt++;
        await sleep((error.retryAfterSeconds ?? 60) * 1000);
        continue;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Managed email send failed", { label, message: msg });
      await logSend(label, to, "failed", messageId, msg);
      return json({ sent: false, error: "send_failed" }, 502);
    }
  }
});
