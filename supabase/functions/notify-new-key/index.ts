import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = "https://aptiskytich.vn";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmail(name: string, keyDate: string, unsubscribeUrl: string) {
  const safeName = esc(name || "bạn");
  const safeDate = esc(keyDate);
  const subject = `Key dự đoán Aptis ngày ${keyDate} đã có — vào ôn ngay`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0F0F10;line-height:1.6;max-width:560px;margin:0 auto">
  <h2 style="color:#CC1C01;margin:0 0 12px">🔑 Key dự đoán ngày ${safeDate} đã cập nhật</h2>
  <p>Chào ${safeName},</p>
  <p>Đội ngũ <b>Aptis Kỳ Tích</b> vừa cập nhật bộ đề trọng tâm theo key dự đoán mới nhất. Hãy vào ôn ngay để bám sát đề thi sắp tới!</p>
  <p style="margin:22px 0">
    <a href="${SITE_URL}/de-key-du-doan" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Vào ôn theo key</a>
  </p>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">— Đội ngũ Aptis Kỳ Tích</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
  <p style="color:#9ca3af;font-size:12px">Không muốn nhận email này? <a href="${unsubscribeUrl}" style="color:#9ca3af">Hủy đăng ký</a>.</p>
</div>`;
  const text = `Chào ${name || "bạn"}, Key dự đoán ngày ${keyDate} đã cập nhật. Vào ôn ngay: ${SITE_URL}/de-key-du-doan`;
  return { subject, html, text };
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
      link_url: "/de-key-du-doan",
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

    // 3. Filter out suppressed
    const { data: suppressed } = await admin
      .from("suppressed_emails")
      .select("email");
    const suppressedSet = new Set(
      (suppressed ?? []).map((r: any) => String(r.email).toLowerCase()),
    );
    const targets = emails.filter((e) => !suppressedSet.has(e.email));

    // 4. Enqueue emails
    let ok = 0;
    let fail = 0;
    for (const t of targets) {
      const idem = `newkey-${keyDate}-${t.email}`;
      // Try to get / create unsubscribe token
      let token: string | null = null;
      const { data: existTok } = await admin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", t.email)
        .maybeSingle();
      if (existTok?.token) {
        token = existTok.token;
      } else {
        const newTok = crypto.randomUUID().replace(/-/g, "");
        const { data: inserted } = await admin
          .from("email_unsubscribe_tokens")
          .insert({ email: t.email, token: newTok })
          .select("token")
          .maybeSingle();
        token = inserted?.token ?? newTok;
      }
      const unsubUrl = `${SITE_URL}/unsubscribe?token=${token}`;
      const { subject, html, text } = buildEmail(t.name, keyDate, unsubUrl);

      const payload = {
        message_id: idem,
        to: t.email,
        from: "aptiskytich <noreply@aptiskytich.vn>",
        sender_domain: "notify.aptiskytich.vn",
        subject,
        html,
        text,
        purpose: "transactional",
        label: "key-update",
        idempotency_key: idem,
        queued_at: new Date().toISOString(),
      };

      const { error } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });
      if (error) fail++;
      else ok++;
    }

    // 5. Log
    await admin
      .from("key_notify_log")
      .insert({ key_date: keyDate, email_count: ok });

    return new Response(
      JSON.stringify({
        already_sent: false,
        total_users: emails.length,
        targeted: targets.length,
        enqueued: ok,
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
