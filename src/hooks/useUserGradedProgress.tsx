import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";

const CEFR_RANK: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };

/** Best AI-graded score per exam_set for writing/speaking.
 *  Reads from writing_skill_results / speaking_skill_results (current graded tables).
 *  Also exposes bandBySetId (best CEFR per exam_set_id) for accurate band badges.
 *  Refreshes on `exam-result-saved` window event so cards update without F5.
 */
export const useUserGradedProgress = (skill: "writing" | "speaking") => {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<ExamProgressMap>(new Map());
  const [bandBySetId, setBandBySetId] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!user) { setProgress(new Map()); setBandBySetId(new Map()); return; }
    const table = skill === "speaking" ? "speaking_skill_results" : "writing_skill_results";
    const { data } = await (supabase as any)
      .from(table)
      .select("exam_set_id,scale50,cefr")
      .eq("user_id", user.id)
      .not("exam_set_id", "is", null);
    const bestScore = new Map<string, number>();
    const bestBand = new Map<string, string>();
    ((data || []) as any[]).forEach((r) => {
      const sid = r.exam_set_id as string | null;
      if (!sid) return;
      const s50 = Number(r.scale50) || 0;
      const prev = bestScore.get(sid) ?? -1;
      if (s50 > prev) bestScore.set(sid, s50);
      const cefr = (r.cefr || "").toString().toUpperCase();
      if (cefr && CEFR_RANK[cefr] !== undefined) {
        const prevBand = bestBand.get(sid);
        if (!prevBand || CEFR_RANK[cefr] > (CEFR_RANK[prevBand] ?? -1)) {
          bestBand.set(sid, cefr);
        }
      }
    });
    const map: ExamProgressMap = new Map();
    bestScore.forEach((s50, sid) => {
      const pct = Math.round((s50 / 50) * 100);
      map.set(sid, { bestScore: pct, total: 100, bestPct: pct });
    });
    setProgress(map);
    setBandBySetId(bestBand);
  }, [user, skill]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  useEffect(() => {
    if (authLoading || !user) return;
    const handler = () => { load(); };
    window.addEventListener("exam-result-saved", handler);
    return () => window.removeEventListener("exam-result-saved", handler);
  }, [authLoading, user, load]);

  return { progress, bandBySetId };
};
