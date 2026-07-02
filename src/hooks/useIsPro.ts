import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserTier = "free" | "pro" | "premium";

export function tierRank(t: string | null | undefined): number {
  if (t === "premium") return 2;
  if (t === "pro") return 1;
  return 0;
}

type TierPayload = {
  tier: UserTier;
  proUntil: string | null;
  plan: string | null;
};

async function fetchUserTier(userId: string | null): Promise<TierPayload> {
  try {
    const [tierRes, subRes] = await Promise.all([
      (supabase as any).rpc("current_user_tier"),
      userId
        ? supabase
            .from("user_subscriptions")
            .select("tier,pro_until")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const t = (tierRes?.data as UserTier) ?? "free";
    return {
      tier: t === "premium" || t === "pro" ? t : "free",
      proUntil: (subRes?.data as any)?.pro_until ?? null,
      plan: (subRes?.data as any)?.tier ?? null,
    };
  } catch {
    return { tier: "free", proUntil: null, plan: null };
  }
}

/**
 * Returns current user's tier (free/pro/premium) plus legacy isPro flag.
 * Source of truth: RPC `current_user_tier` (respects promo_active + user_subscriptions).
 *
 * Shared across the whole app via React Query with a stable queryKey so the
 * DB is only hit once per user regardless of how many components mount this
 * hook in a single render pass.
 */
export function useIsPro() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["userTier", userId],
    queryFn: () => fetchUserTier(userId),
    enabled: !authLoading && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const defaultPayload: TierPayload = { tier: "free", proUntil: null, plan: null };
  const data: TierPayload = !userId ? defaultPayload : (query.data ?? defaultPayload);
  const { tier, proUntil, plan } = data;

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["userTier", userId] });
  }, [queryClient, userId]);

  const isPro = tier === "pro" || tier === "premium";
  const isPremium = tier === "premium";
  const loading = authLoading || (query.isPending && query.fetchStatus !== "idle");

  return { isPro, isPremium, tier, proUntil, plan, loading, refetch };
}
