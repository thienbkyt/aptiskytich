import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";
import { getSkillBand } from "@/data/questions";


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
      .select("exam_set_id,scale50,cefr,raw_total,parts")
      .eq("user_id", user.id)
      .not("exam_set_id", "is", null);

    const bestBand = new Map<string, string>();
    const map: ExamProgressMap = new Map();

    // Bands are ALWAYS recomputed from scale50 with the official Aptis
    // thresholds; the stored `cefr` column is only used to detect whether the
    // attempt was a complete (4-part) one.
    if (skill === "writing") {
      const best30 = new Map<string, number>();
      ((data || []) as any[]).forEach((r) => {
        const sid = r.exam_set_id as string | null;
        if (!sid) return;
        const cefr = (r.cefr || "").toString().toUpperCase();
        let val: number | null = null;
        if (!cefr) {
          val = Math.round(Number(r.raw_total) || 0);
        } else {
          const p = r.parts || {};
          const keys = ["task1", "task2", "task3", "task4"];
          if (keys.every((k) => p && p[k] !== undefined && p[k] !== null)) {
            val = Math.round(Number(p.task4?.rawPart) || 0);
          }
          const derived = cefr;
          if (CEFR_RANK[derived] !== undefined) {
            const prevBand = bestBand.get(sid);
            if (!prevBand || CEFR_RANK[derived] > (CEFR_RANK[prevBand] ?? -1)) bestBand.set(sid, derived);
          }
        }
        if (val != null && val > (best30.get(sid) ?? -1)) best30.set(sid, val);
      });
      best30.forEach((v, sid) => {
        map.set(sid, { bestScore: v, total: 30, bestPct: Math.round((v / 30) * 100) });
      });
      setProgress(map);
      setBandBySetId(bestBand);
      return;
    }

    const bestScore = new Map<string, number>();
    const bestRaw = new Map<string, number>();
    ((data || []) as any[]).forEach((r) => {
      const sid = r.exam_set_id as string | null;
      if (!sid) return;
      const s50 = Number(r.scale50) || 0;
      const prev = bestScore.get(sid) ?? -1;
      if (s50 > prev) bestScore.set(sid, s50);
      const cefr = (r.cefr || "").toString().toUpperCase();
      if (!cefr) {
        // Single-part attempt: no CEFR, score is raw /30.
        const raw = Number(r.raw_total) || 0;
        if (raw > (bestRaw.get(sid) ?? -1)) bestRaw.set(sid, raw);
      }
      if (cefr) {
        const derived = cefr;
        const prevBand = bestBand.get(sid);
        if (!prevBand || (CEFR_RANK[derived] ?? -1) > (CEFR_RANK[prevBand] ?? -1)) {
          bestBand.set(sid, derived);
        }
      }
    });

    bestScore.forEach((s50, sid) => {
      if (!bestBand.has(sid) && bestRaw.has(sid)) {
        const raw = bestRaw.get(sid) as number;
        map.set(sid, { bestScore: raw, total: 30, bestPct: Math.round((raw / 30) * 100) });
        return;
      }
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
