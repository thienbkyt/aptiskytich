import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SiteStats = {
  de_count: number;
  user_count: number;
  attempt_count: number;
};

/** Làm tròn xuống bội số 100, format kiểu VN, thêm "+" (726 → "700+", 3411 → "3.400+") */
export function formatStat(n: number | null | undefined, fallback: string): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 100) return fallback;
  const floored = Math.floor(n / 100) * 100;
  return `${floored.toLocaleString("vi-VN")}+`;
}

const FALLBACK = {
  de: "700+",
  user: "3.400+",
  attempt: "91.000+",
};

export function useSiteStats() {
  const { data } = useQuery({
    queryKey: ["site-stats"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<SiteStats | null> => {
      const { data, error } = await supabase.rpc("get_site_stats");
      if (error) throw error;
      return (data as unknown as SiteStats) ?? null;
    },
  });

  return {
    deCount: formatStat(data?.de_count, FALLBACK.de),
    userCount: formatStat(data?.user_count, FALLBACK.user),
    attemptCount: formatStat(data?.attempt_count, FALLBACK.attempt),
  };
}
