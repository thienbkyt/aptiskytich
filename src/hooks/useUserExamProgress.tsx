import { useEffect, useState } from "react";
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
  const [progress, setProgress] = useState<ExamProgressMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProgress(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("test_results")
          .select("exam_set_id,score,total")
          .eq("user_id", user.id)
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
        if (!cancelled) setProgress(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { progress, loading };
};
