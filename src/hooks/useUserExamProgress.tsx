import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ExamProgressItem {
  bestScore: number;
  total: number;
  bestPct: number;
}

export type ExamProgressMap = Map<string, ExamProgressItem>;

/**
 * Fetches the signed-in user's best score per exam_set_id from test_results.
 * Returns an empty map for logged-out users.
 */
export const useUserExamProgress = () => {
  const { user, loading: authLoading } = useAuth();
  const enabled = !authLoading && !!user;

  const { data, isLoading } = useQuery({
    queryKey: ["userExamProgress", user?.id],
    enabled,
    queryFn: async (): Promise<ExamProgressMap> => {
      const { data } = await supabase
        .from("test_results")
        .select("exam_set_id,score,total")
        .eq("user_id", user!.id)
        .not("exam_set_id", "is", null);
      const map: ExamProgressMap = new Map();
      (data || []).forEach((r: any) => {
        if (!r.exam_set_id) return;
        if (r.total <= 0 || r.score > r.total) return;
        const prev = map.get(r.exam_set_id);
        const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
        if (!prev || r.score > prev.bestScore) {
          map.set(r.exam_set_id, { bestScore: r.score, total: r.total, bestPct: pct });
        }
      });
      return map;
    },
  });

  if (!enabled) {
    return { progress: new Map() as ExamProgressMap, loading: authLoading };
  }
  return { progress: data ?? (new Map() as ExamProgressMap), loading: isLoading };
};
