import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EmailAPIError } from "npm:@lovable.dev/email-js@0.1.0";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPLATE_NAME = "key-update";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const keyDate = String(body?.key_date || "").trim();
    if (!keyDate) {
      return new Response(JSON.stringify({ error: "Missing key_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency
    const { data: existing } = await admin
      .from("key_notify_log")
      .select("key_date, email_count")
      .eq("key_date", keyDate)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ already_sent: true, email_count: existing.email_count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Broadcast notification
    const { error: notifErr } = await admin.from("notifications").insert({
      title: `🔑 Key dự đoán ngày ${keyDate} đã cập nhật`,
      body: "Bộ đề trọng tâm theo key mới nhất đã sẵn sàng. Vào ôn ngay để bám sát đề thi!",
      type: "key_update",
      link_url: "/key-du-doan",
      is_active: true,
      created_by: userData.user.id,
    });
    if (notifErr) {
      return new Response(JSON.stringify({ error: notifErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Gather confirmed users
    const emails: { email: string; name: string }[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const users = data?.users ?? [];
      for (const u of users) {
        if (!u.email || !u.email_confirmed_at) continue;
        const name =
          (u.user_metadata as any)?.full_name ||
          (u.user_metadata as any)?.name ||
          u.email.split("@")[0];
        emails.push({ email: u.email.toLowerCase(), name });
      }
      if (users.length < perPage) break;
      page++;
      if (page > 50) break;
    }

    // 3. Send emails (suppression is enforced server-side at send time)
    const targets = emails;
    let ok = 0;
    let fail = 0;
    let suppressedCount = 0;

    async function logSend(
      email: string,
      status: "sent" | "suppressed" | "failed",
      errorMessage?: string,
    ) {
      const { error } = await admin.from("email_send_log").insert({
        template_name: TEMPLATE_NAME,
        recipient_email: email,
        status,
        error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
      });
      if (error) {
        console.error("Failed to write email_send_log row", {
          code: error.code,
          message: error.message,
        });
      }
    }

    for (const t of targets) {
      const idem = `newkey-${keyDate}-${t.email}`;
      let attempt = 0;

      while (true) {
        try {
          const result = await sendTemplateEmail(TEMPLATE_NAME, t.email, {
            templateData: { name: t.name, keyDate },
            idempotencyKey: idem,
          });

          if (result.sent) {
            ok++;
            await logSend(t.email, "sent");
          } else {
            suppressedCount++;
            await logSend(t.email, "suppressed", "Recipient suppressed");
          }
          break;
        } catch (error) {
          if (
            error instanceof EmailAPIError &&
            error.status === 429 &&
            attempt === 0
          ) {
            attempt++;
            await sleep((error.retryAfterSeconds ?? 60) * 1000);
            continue;
          }

          const msg = error instanceof Error ? error.message : String(error);
          fail++;
          await logSend(t.email, "failed", msg);
          break;
        }
      }
    }

    // 4. Log
    await admin
      .from("key_notify_log")
      .insert({ key_date: keyDate, email_count: ok });

    return new Response(
      JSON.stringify({
        already_sent: false,
        total_users: emails.length,
        targeted: targets.length,
        sent: ok,
        suppressed: suppressedCount,
        failed: fail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
