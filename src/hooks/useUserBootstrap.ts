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
 *
 * Throws on error or when the returned uid is missing/mismatched (token not
 * restored yet) so React Query retries instead of caching a bogus "free"
 * bootstrap for 10 minutes.
 */
async function fetchBootstrap(expectedUserId: string): Promise<UserBootstrap> {
  const early = (window as any).__ktBootstrapPromise as
    | Promise<{ data: any; error: any } | null>
    | undefined;
  let result: { data: any; error: any } | null;
  if (early) {
    delete (window as any).__ktBootstrapPromise;
    result = await early;
    // Early prefetch ran before the session was ready — fire a fresh call.
    if (result == null) {
      result = await (supabase as any).rpc("get_user_bootstrap");
    }
  } else {
    result = await (supabase as any).rpc("get_user_bootstrap");
  }
  const { data, error } = result;
  if (error) throw error;
  if (!data) throw new Error("bootstrap_no_data");
  const d = data as any;
  if (!d.uid || d.uid !== expectedUserId) throw new Error("bootstrap_no_uid");
  const tier: UserTier =
    d.tier === "premium" || d.tier === "pro" ? d.tier : "free";
  return {
    tier,
    subscription: d.subscription ?? null,
    unread_notification_count: Number(d.unread_notification_count) || 0,
  };
}

export function useUserBootstrap() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["userBootstrap", userId],
    queryFn: () => fetchBootstrap(userId!),
    enabled: !authLoading && !!userId,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
    loading:
      authLoading ||
      (!!userId &&
        (query.isPending ||
          query.isRefetching ||
          (query.isError && query.fetchStatus !== "idle"))),
    refetch,
    setUnread,
  };
}
