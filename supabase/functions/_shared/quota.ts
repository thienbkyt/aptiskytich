// Daily AI quota enforcement shared by edge functions.
// Atomically increments a counter in public.ai_daily_quota via the
// `consume_ai_quota` RPC (SECURITY DEFINER, service-role only).
//
// Returns:
//   null  → request is within today's quota, proceed
//   Response (429) → quota exceeded; return it from the edge function directly

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type QuotaAction = "grade-exam" | "ai-coach" | "dictionary-lookup";

export async function enforceDailyQuota(
  userId: string,
  action: QuotaAction,
  limit: number,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null; // fail-open if misconfigured
    const client = createClient(url, key);
    const { data, error } = await client.rpc("consume_ai_quota", {
      _user_id: userId,
      _action: action,
      _limit: limit,
    });
    if (error) {
      console.error("[quota] rpc error:", error);
      return null; // fail-open
    }
    const ok = (data as any)?.ok !== false;
    if (!ok) {
      return new Response(
        JSON.stringify({
          error: "Bạn đã đạt giới hạn hôm nay, thử lại ngày mai.",
          quotaExceeded: true,
          action,
          limit,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "86400",
          },
        },
      );
    }
    return null;
  } catch (e) {
    console.error("[quota] failed:", e);
    return null;
  }
}
