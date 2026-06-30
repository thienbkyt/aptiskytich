import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";

/** Best marathon score per part (key "part1"..) for a skill. */
export const useUserMarathonProgress = (skill: "reading" | "listening") => {
  const { user, loading: authLoading } = useAuth();
  const enabled = !authLoading && !!user;

  const { data } = useQuery({
    queryKey: ["userMarathonProgress", skill, user?.id],
    enabled,
    queryFn: async (): Promise<ExamProgressMap> => {
      const { data } = await supabase
        .from("test_results")
        .select("score, total, skill_scores")
        .eq("user_id", user!.id)
        .is("exam_set_id", null);
      const map: ExamProgressMap = new Map();
      (data || []).forEach((r: any) => {
        const ss = r.skill_scores || {};
        if (ss.mode !== "marathon" || ss.skill !== skill) return;
        const m = String(ss.label || "").match(/Part\s*(\d)/i);
        if (!m) return;
        if (!r.total || r.total <= 0 || r.score > r.total) return;
        const part = `part${m[1]}`;
        const prev = map.get(part);
        if (!prev || r.score > prev.bestScore) {
          map.set(part, { bestScore: r.score, total: r.total, bestPct: Math.round((r.score / r.total) * 100) });
        }
      });
      return map;
    },
  });

  if (!enabled) {
    return { progress: new Map() as ExamProgressMap };
  }
  return { progress: data ?? (new Map() as ExamProgressMap) };
};
