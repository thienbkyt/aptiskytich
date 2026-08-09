import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac } from "node:crypto";

const PAYOS_CLIENT_ID = Deno.env.get("PAYOS_CLIENT_ID")!;
const PAYOS_API_KEY = Deno.env.get("PAYOS_API_KEY")!;
const PAYOS_CHECKSUM_KEY = Deno.env.get("PAYOS_CHECKSUM_KEY")!;

function signPayload(obj: Record<string, string | number>): string {
  // payOS: sort keys alphabetically, concat as key=value&..., HMAC-SHA256 with checksum key
  const keys = Object.keys(obj).sort();
  const data = keys.map((k) => `${k}=${obj[k] ?? ""}`).join("&");
  return createHmac("sha256", PAYOS_CHECKSUM_KEY).update(data).digest("hex");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const planKey = String(body?.plan_key ?? "").trim();
    const promoCode = String(body?.promo_code ?? "").trim().toUpperCase();
    if (!planKey) {
      return new Response(JSON.stringify({ error: "Missing plan_key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read plan server-side (don't trust client amount)
    const { data: plan, error: planErr } = await admin
      .from("pricing_plans")
      .select("key,label,price_vnd,duration_days,tier,active")
      .eq("key", planKey)
      .eq("active", true)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tier = (plan as any).tier ?? ((plan as any).duration_days == null ? "premium" : "pro");
    const amount = Number((plan as any).price_vnd);
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid plan price" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique orderCode (max 9007199254740991, fits bigint). Use timestamp + random.
    const orderCode = Number(`${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`);

    const appOrigin = Deno.env.get("APP_ORIGIN") || "https://aptiskytich.vn";
    const returnUrl = `${appOrigin}/pricing?paid=1`;
    const cancelUrl = `${appOrigin}/pricing?cancel=1`;
    const description = `${tier === "premium" ? "Premium" : "Pro"} ${planKey}`.slice(0, 25);

    // Validate promo code server-side (never trust client). Invalid code = order
    // still created, just without any gift/discount attached.
    let validVoucherCode: string | null = null;
    let finalAmount = amount;
    if (promoCode) {
      const { data: vc } = await admin
        .from("voucher_codes")
        .select("code_norm,kind,enabled,expires_at,applies_to_plans,discount_percent,discount_max_vnd")
        .eq("code_norm", promoCode)
        .maybeSingle();
      const nowIso = Date.now();
      const notExpired = !vc?.expires_at || new Date(vc.expires_at as string).getTime() > nowIso;
      const plans = (vc as any)?.applies_to_plans as string[] | null | undefined;
      const planOk = !plans || plans.length === 0 || plans.includes(planKey);
      if (vc && vc.enabled === true && notExpired && vc.kind === "checkout" && planOk) {
        validVoucherCode = promoCode;
        const pct = Number((vc as any).discount_percent ?? 0);
        const capVnd = (vc as any).discount_max_vnd as number | null;
        if (pct > 0) {
          const off = Math.floor((amount * pct) / 100);
          const capped = capVnd ? Math.min(off, capVnd) : off;
          finalAmount = Math.max(1000, amount - capped); // sàn 1000đ, payOS không nhận 0
        }
      } else {
        console.log("create-payment: promo code ignored", promoCode);
      }
    }

    // Insert pending payment first
    const { error: insertErr } = await admin.from("payments").insert({
      user_id: userId,
      plan_key: planKey,
      tier,
      amount_vnd: finalAmount,
      order_code: orderCode,
      status: "pending",
      voucher_code: validVoucherCode,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: "Cannot create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign and call payOS
    const signature = signPayload({
      amount: finalAmount,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    });


    const payosRes = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": PAYOS_CLIENT_ID,
        "x-api-key": PAYOS_API_KEY,
      },
      body: JSON.stringify({
        orderCode,
        amount,
        description,
        returnUrl,
        cancelUrl,
        signature,
      }),
    });
    const payosJson = await payosRes.json().catch(() => ({}));

    if (!payosRes.ok || payosJson?.code !== "00" || !payosJson?.data?.checkoutUrl) {
      await admin.from("payments").update({
        status: "failed",
        raw_response: payosJson,
      }).eq("order_code", orderCode);
      console.error("payOS create failed", payosRes.status, payosJson?.code, payosJson?.desc);
      return new Response(JSON.stringify({ error: "Payment provider error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutUrl = payosJson.data.checkoutUrl as string;
    const linkId = payosJson.data.paymentLinkId as string;

    await admin.from("payments").update({
      payos_link_id: linkId,
      checkout_url: checkoutUrl,
      raw_response: payosJson.data,
    }).eq("order_code", orderCode);

    return new Response(JSON.stringify({
      checkoutUrl,
      orderCode,
      accountNumber: payosJson.data.accountNumber ?? null,
      accountName: payosJson.data.accountName ?? null,
      bin: payosJson.data.bin ?? null,
      amount,
      description,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-payment error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
