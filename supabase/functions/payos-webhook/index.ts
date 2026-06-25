import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac } from "node:crypto";

const PAYOS_CHECKSUM_KEY = Deno.env.get("PAYOS_CHECKSUM_KEY")!;

// payOS signs `data` (object) by: sort keys alphabetically, build key=value&...
// For nested arrays/objects, stringify them. Empty/null → "".
function buildSignString(data: Record<string, unknown>): string {
  const keys = Object.keys(data).sort();
  return keys.map((k) => {
    const v = data[k];
    let s: string;
    if (v === null || v === undefined) s = "";
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    return `${k}=${s}`;
  }).join("&");
}

function hmacHex(payload: string): string {
  return createHmac("sha256", PAYOS_CHECKSUM_KEY).update(payload).digest("hex");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // payOS sends a verification ping (no data) on webhook registration
    const data = body?.data;
    const signature = body?.signature;

    if (!data || !signature) {
      // Accept ping
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VERIFY signature — required
    const expected = hmacHex(buildSignString(data as Record<string, unknown>));
    if (expected !== signature) {
      console.warn("Invalid signature", { orderCode: (data as any)?.orderCode });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderCode = Number((data as any).orderCode);
    const code = body?.code ?? (data as any)?.code;
    const isPaid = code === "00" || (data as any)?.code === "00";

    if (!isPaid) {
      // Not a successful payment event — record but don't activate
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup order
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id,user_id,plan_key,tier,amount_vnd,status")
      .eq("order_code", orderCode)
      .maybeSingle();

    if (payErr || !payment) {
      console.warn("Payment not found", orderCode);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotent
    if ((payment as any).status === "paid") {
      return new Response(JSON.stringify({ success: true, already: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load plan for duration
    const { data: plan } = await admin
      .from("pricing_plans")
      .select("tier,duration_days")
      .eq("key", (payment as any).plan_key)
      .maybeSingle();

    const tier = (plan as any)?.tier ?? (payment as any).tier ?? "pro";
    const duration = (plan as any)?.duration_days ?? null;

    // Read current subscription
    const { data: currentSub } = await admin
      .from("user_subscriptions")
      .select("tier,pro_until")
      .eq("user_id", (payment as any).user_id)
      .maybeSingle();

    const isCurrentPremium = (currentSub as any)?.tier === "premium";

    let newTier: string;
    let newProUntil: string | null;

    if (tier === "premium") {
      newTier = "premium";
      newProUntil = null;
    } else {
      // Pro purchase
      if (isCurrentPremium) {
        // Do NOT downgrade premium; still mark payment paid
        newTier = "premium";
        newProUntil = (currentSub as any)?.pro_until ?? null;
      } else {
        const now = new Date();
        const base = (currentSub as any)?.pro_until
          ? new Date((currentSub as any).pro_until)
          : now;
        const start = base > now ? base : now;
        const end = duration
          ? new Date(start.getTime() + Number(duration) * 86400000)
          : null;
        newTier = "pro";
        newProUntil = end ? end.toISOString() : null;
      }
    }

    // Upsert subscription
    const { error: upsertErr } = await admin
      .from("user_subscriptions")
      .upsert({
        user_id: (payment as any).user_id,
        tier: newTier,
        pro_until: newProUntil,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("Subscription upsert failed", upsertErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark paid
    await admin.from("payments").update({
      status: "paid",
      paid_at: new Date().toISOString(),
    }).eq("id", (payment as any).id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("payos-webhook error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
