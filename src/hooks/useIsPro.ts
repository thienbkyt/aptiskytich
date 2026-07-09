import { useUserBootstrap, type UserTier } from "@/hooks/useUserBootstrap";

export type { UserTier };

export function tierRank(t: string | null | undefined): number {
  if (t === "premium") return 2;
  if (t === "pro") return 1;
  return 0;
}

/**
 * Backward-compatible wrapper around useUserBootstrap so existing call sites
 * keep working while all tier/subscription data comes from the single
 * bootstrap RPC (get_user_bootstrap).
 */
export function useIsPro() {
  const b = useUserBootstrap();
  return {
    isPro: b.isPro,
    isPremium: b.isPremium,
    tier: b.tier,
    proUntil: b.subscription?.pro_until ?? null,
    plan: b.subscription?.tier ?? null,
    loading: b.loading,
    refetch: b.refetch,
  };
}

