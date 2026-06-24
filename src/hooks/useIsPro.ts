import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current user has Pro access (real Pro OR active promo).
 * Source of truth: RPC `current_user_is_pro` (which respects promo_active + user_subscriptions).
 */
export function useIsPro() {
  const { user, loading: authLoading } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        // promo can still be active for anon — but we gate on signed-in users for now
        const { data } = await supabase.rpc("promo_active");
        setIsPro(!!data);
      } else {
        const { data } = await supabase.rpc("current_user_is_pro");
        setIsPro(!!data);
      }
    } catch {
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  return { isPro, loading, refetch };
}
