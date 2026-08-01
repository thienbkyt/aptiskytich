// Grants checkout-voucher rewards for paid orders.
//
// Runs on a cron (every 5 minutes) AFTER the payos webhook has already
// upgraded the subscription for the purchased plan. This job never touches
// the webhook logic — it only reads public.payments rows that carry a
// voucher_code and grants the extra days / AI credits on top.
//
// Idempotency: voucher_redemptions has a unique index on payment_id, and the
// redemption row is inserted LAST for each order.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BATCH_LIMIT = 50;
const LOOKBACK_DAYS = 7;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const claims = parseJwtClaims(authHeader.slice("Bearer ".length).trim());
  if (claims?.role !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let granted = 0;
  let skipped = 0;

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600_000).toISOString();

    const { data: payments, error: payErr } = await admin
      .from("payments")
      .select("id,user_id,plan_key,voucher_code,paid_at")
      .eq("status", "paid")
      .not("voucher_code", "is", null)
      .gt("paid_at", since)
      .order("paid_at", { ascending: true })
      .limit(200);
    if (payErr) throw payErr;

    const candidates = payments ?? [];
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ processed, granted, skipped }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing, error: exErr } = await admin
      .from("voucher_redemptions")
      .select("payment_id")
      .in("payment_id", candidates.map((p: any) => p.id));
    if (exErr) throw exErr;
    const done = new Set((existing ?? []).map((r: any) => r.payment_id));

    const pending = candidates.filter((p: any) => !done.has(p.id)).slice(0, BATCH_LIMIT);

    for (const p of pending as any[]) {
      processed++;
      try {
        const code = String(p.voucher_code ?? "").trim().toUpperCase();
        const { data: vc, error: vcErr } = await admin
          .from("voucher_codes")
          .select("id,kind,gift_days,gift_ai_cap,gift_ai_credits,credit_expires_at,applies_to_plans")
          .eq("code_norm", code)
          .maybeSingle();
        if (vcErr) throw vcErr;
        if (!vc || vc.kind !== "checkout") {
          console.warn("grant-voucher-rewards: code not usable", { payment: p.id, code });
          skipped++;
          continue;
        }

        const plans = (vc as any).applies_to_plans as string[] | null;
        if (plans && plans.length > 0 && !plans.includes(p.plan_key)) {
          console.warn("grant-voucher-rewards: plan not eligible", {
            payment: p.id, code, plan: p.plan_key,
          });
          skipped++;
          continue;
        }

        const { data: sub } = await admin
          .from("user_subscriptions")
          .select("tier,pro_until,ai_daily_cap")
          .eq("user_id", p.user_id)
          .maybeSingle();

        const now = Date.now();
        const proUntilMs = sub?.pro_until ? new Date(sub.pro_until as string).getTime() : null;
        const stillActive = proUntilMs != null && proUntilMs > now;
        const giftDays = Number((vc as any).gift_days ?? 0);
        const giftCap = (vc as any).gift_ai_cap as number | null;
        const currentCap = (sub?.ai_daily_cap ?? null) as number | null;

        let newUntilIso: string | null = null;

        if (giftDays > 0 && sub?.tier !== "premium") {
          const base = Math.max(proUntilMs ?? now, now);
          newUntilIso = new Date(base + giftDays * 24 * 3600_000).toISOString();
          const nextCap = giftCap == null
            ? currentCap
            : (stillActive ? Math.max(currentCap ?? 0, giftCap) : giftCap);

          const { error: upErr } = await admin.from("user_subscriptions").upsert({
            user_id: p.user_id,
            tier: "pro",
            pro_until: newUntilIso,
            ai_daily_cap: nextCap,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          if (upErr) throw upErr;
        }

        const giftCredits = Number((vc as any).gift_ai_credits ?? 0);
        if (giftCredits > 0) {
          const expiresAt = (vc as any).credit_expires_at
            ?? newUntilIso
            ?? (sub?.pro_until ?? null);
          const { error: grantErr } = await admin.from("ai_credit_grants").insert({
            user_id: p.user_id,
            amount: giftCredits,
            source_code_id: (vc as any).id,
            expires_at: expiresAt,
          });
          if (grantErr) throw grantErr;
        }

        const { error: redErr } = await admin.from("voucher_redemptions").insert({
          code_id: (vc as any).id,
          user_id: p.user_id,
          payment_id: p.id,
        });
        if (redErr) {
          if ((redErr as any).code === "23505") {
            console.warn("grant-voucher-rewards: already redeemed", { payment: p.id });
            skipped++;
            continue;
          }
          throw redErr;
        }

        granted++;
        console.log("grant-voucher-rewards: granted", {
          payment: p.id, code, giftDays, giftCredits, until: newUntilIso,
        });
      } catch (e) {
        skipped++;
        console.error("grant-voucher-rewards: order failed", p.id, e);
      }
    }

    return new Response(JSON.stringify({ processed, granted, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grant-voucher-rewards error", e);
    return new Response(JSON.stringify({ error: "Internal error", processed, granted, skipped }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
