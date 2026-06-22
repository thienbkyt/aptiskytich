import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";

/** Best AI-graded score per exam_set for writing/speaking (from *_question_gradings). */
export const useUserGradedProgress = (skill: "writing" | "speaking") => {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<ExamProgressMap>(new Map());

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setProgress(new Map()); return; }
    let cancelled = false;
    (async () => {
      const table = skill === "writing" ? "writing_question_gradings" : "speaking_question_gradings";
      const { data } = await supabase
        .from(table)
        .select("exam_set_id, test_result_id, part_score, max_points")
        .eq("user_id", user.id);
      const byTest = new Map<string, { setId: string; score: number; max: number }>();
      (data || []).forEach((r: any) => {
        if (!r.exam_set_id || !r.test_result_id) return;
        const e = byTest.get(r.test_result_id) || { setId: r.exam_set_id, score: 0, max: 0 };
        e.score += Number(r.part_score) || 0;
        e.max += Number(r.max_points) || 0;
        byTest.set(r.test_result_id, e);
      });
      const map: ExamProgressMap = new Map();
      byTest.forEach(({ setId, score, max }) => {
        if (max <= 0) return;
        const prev = map.get(setId);
        if (!prev || score > prev.bestScore) {
          map.set(setId, { bestScore: Math.round(score), total: Math.round(max), bestPct: Math.round((score / max) * 100) });
        }
      });
      if (!cancelled) setProgress(map);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, skill]);

  return { progress };
};
