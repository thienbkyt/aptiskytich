import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeStorage";

type SiteStats = {
  de_count: number;
  user_count: number;
  attempt_count: number;
};

const CACHE_KEY = "kt_site_stats_v1";

/** Số chính xác, ngăn nghìn kiểu Việt Nam (726 → "726", 3411 → "3.411") */
export function formatStat(n: number | null | undefined, fallback: string): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return fallback;
  return new Intl.NumberFormat("vi-VN").format(Math.floor(n));
}

const FALLBACK = {
  de: "726",
  user: "3.411",
  attempt: "91.302",
};

function readCache(): SiteStats | undefined {
  try {
    const raw = safeLocalStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as SiteStats;
    if (typeof parsed?.de_count === "number") return parsed;
  } catch {
    /* ignore */
  }
  return undefined;
}

export function useSiteStats() {
  const { data } = useQuery({
    queryKey: ["site-stats"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev ?? readCache(),
    queryFn: async (): Promise<SiteStats | null> => {
      const { data, error } = await supabase.rpc("get_site_stats");
      if (error) throw error;
      const stats = (data as unknown as SiteStats) ?? null;
      if (stats) {
        try {
          safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(stats));
        } catch {
          /* ignore */
        }
      }
      return stats;
    },
  });

  return {
    deCount: formatStat(data?.de_count, FALLBACK.de),
    userCount: formatStat(data?.user_count, FALLBACK.user),
    attemptCount: formatStat(data?.attempt_count, FALLBACK.attempt),
  };
}
