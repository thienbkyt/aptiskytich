import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserTier = "free" | "pro" | "premium";

export interface UserBootstrap {
  tier: UserTier;
  subscription: { tier: string | null; pro_until: string | null } | null;
  unread_notification_count: number;
}

const DEFAULT: UserBootstrap = {
  tier: "free",
  subscription: null,
  unread_notification_count: 0,
};

/**
 * Fires the get_user_bootstrap RPC. Awaits any early prefetch fired in main.tsx.
 * Never called for anon users — landing page stays at 0 Supabase calls when
 * signed out.
 */
async function fetchBootstrap(): Promise<UserBootstrap> {
  const early = (window as any).__ktBootstrapPromise as
    | Promise<{ data: any; error: any }>
    | undefined;
  const p = early ?? (supabase as any).rpc("get_user_bootstrap");
  // Consume the early promise once.
  if (early) delete (window as any).__ktBootstrapPromise;
  try {
    const { data, error } = await p;
    if (error || !data) return DEFAULT;
    const d = data as any;
    const tier: UserTier =
      d.tier === "premium" || d.tier === "pro" ? d.tier : "free";
    return {
      tier,
      subscription: d.subscription ?? null,
      unread_notification_count: Number(d.unread_notification_count) || 0,
    };
  } catch {
    return DEFAULT;
  }
}

export function useUserBootstrap() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["userBootstrap", userId],
    queryFn: fetchBootstrap,
    enabled: !authLoading && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const data: UserBootstrap = !userId ? DEFAULT : query.data ?? DEFAULT;

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["userBootstrap", userId] });
  }, [qc, userId]);

  const setUnread = useCallback(
    (updater: number | ((prev: number) => number)) => {
      qc.setQueryData<UserBootstrap>(["userBootstrap", userId], (prev) => {
        const base = prev ?? DEFAULT;
        const next =
          typeof updater === "function"
            ? updater(base.unread_notification_count)
            : updater;
        return { ...base, unread_notification_count: Math.max(0, next) };
      });
    },
    [qc, userId],
  );

  return {
    ...data,
    isPro: data.tier === "pro" || data.tier === "premium",
    isPremium: data.tier === "premium",
    loading: authLoading || (!!userId && query.isPending && query.fetchStatus !== "idle"),
    refetch,
    setUnread,
  };
}
