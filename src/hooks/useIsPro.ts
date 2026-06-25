import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current user has Pro access (real Pro OR active promo).
 * Source of truth: RPC `current_user_is_pro` (which respects promo_active + user_subscriptions).
 * Also returns `proUntil` (subscription expiry, null = lifetime / none) and `plan`.
 */
export function useIsPro() {
  const { user, loading: authLoading } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        const { data } = await supabase.rpc("promo_active");
        setIsPro(!!data);
        setProUntil(null);
        setPlan(null);
      } else {
        const [proRes, subRes] = await Promise.all([
          supabase.rpc("current_user_is_pro"),
          supabase
            .from("user_subscriptions")
            .select("tier,pro_until")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
        setIsPro(!!proRes.data);
        setProUntil((subRes.data as any)?.pro_until ?? null);
        setPlan((subRes.data as any)?.tier ?? null);
      }
    } catch {
      setIsPro(false);
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

  return { isPro, proUntil, plan, loading, refetch };
}
