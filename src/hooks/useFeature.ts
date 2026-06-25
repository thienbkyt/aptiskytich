import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { UserTier } from "@/hooks/useIsPro";

export interface FeatureAccess {
  allowed: boolean;
  reason?: string;
  isPro: boolean;
  tier: UserTier;
  requiredTier?: "free" | "pro" | "premium";
  freeQuota?: number | null;
  proQuota?: number | null;
  used?: number;
  remaining?: number | null;
  enabled: boolean;
}

export interface UseFeatureResult extends FeatureAccess {
  loading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT: FeatureAccess = {
  allowed: false,
  isPro: false,
  tier: "free",
  enabled: true,
};

export function useFeature(key: string, scope?: string | null): UseFeatureResult {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<FeatureAccess>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("check_feature_access", {
        p_key: key,
        p_scope: scope ?? null,
      });
      if (error) {
        setState({ allowed: false, isPro: false, tier: "free", enabled: true, reason: "error" });
      } else {
        const d = (data ?? {}) as any;
        setState({
          allowed: !!d.allowed,
          reason: d.reason,
          isPro: !!d.is_pro,
          tier: (d.tier as UserTier) ?? "free",
          requiredTier: d.required_tier,
          freeQuota: d.free_quota,
          proQuota: d.pro_quota,
          used: d.used,
          remaining: d.remaining,
          enabled: d.enabled !== false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [key, scope]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ allowed: false, isPro: false, tier: "free", enabled: true, reason: "unauthenticated" });
      setLoading(false);
      return;
    }
    fetchAccess();
  }, [user, authLoading, fetchAccess]);

  return { ...state, loading, refetch: fetchAccess };
}

/** Helper to log feature usage (call after a feature is actually consumed). */
export async function logFeatureUsage(key: string, refId?: string | null, scope?: string | null) {
  try {
    await supabase.rpc("log_feature_usage", {
      p_key: key,
      p_ref: refId ?? null,
      p_scope: scope ?? null,
    });
  } catch (e) {
    console.warn("[logFeatureUsage] failed:", e);
  }
}
