import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserTier = "free" | "pro" | "premium";

export function tierRank(t: string | null | undefined): number {
  if (t === "premium") return 2;
  if (t === "pro") return 1;
  return 0;
}

/**
 * Returns current user's tier (free/pro/premium) plus legacy isPro flag.
 * Source of truth: RPC `current_user_tier` (respects promo_active + user_subscriptions).
 */
export function useIsPro() {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<UserTier>("free");
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [tierRes, subRes] = await Promise.all([
        (supabase as any).rpc("current_user_tier"),
        user
          ? supabase
              .from("user_subscriptions")
              .select("tier,pro_until")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const t = (tierRes?.data as UserTier) ?? "free";
      setTier(t === "premium" || t === "pro" ? t : "free");
      setProUntil((subRes?.data as any)?.pro_until ?? null);
      setPlan((subRes?.data as any)?.tier ?? null);
    } catch {
      setTier("free");
      setProUntil(null);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  const isPro = tier === "pro" || tier === "premium";
  const isPremium = tier === "premium";

  return { isPro, isPremium, tier, proUntil, plan, loading, refetch };
}
