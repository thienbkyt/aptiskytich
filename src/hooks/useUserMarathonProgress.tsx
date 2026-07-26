import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";

/** Best marathon score per part (key "part1"..) for a skill. */
export const useUserMarathonProgress = (skill: "reading" | "listening") => {
  const { user, loading: authLoading } = useAuth();
  const enabled = !authLoading && !!user;
  const queryClient = useQueryClient();

  useEffect(() => {
    const onSaved = () => {
      queryClient.invalidateQueries({ queryKey: ["userMarathonProgress", skill, user?.id] });
    };
    window.addEventListener("exam-result-saved", onSaved as EventListener);
    return () => window.removeEventListener("exam-result-saved", onSaved as EventListener);
  }, [queryClient, skill, user?.id]);

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
        // Prefer the explicit part code written at save time.
        let part: string | null =
          typeof ss.partType === "string" && /^part[1-9]$/.test(ss.partType) ? ss.partType : null;
        if (!part) {
          // Legacy rows: derive from the display label, per skill (Reading labels are offset).
          const m = String(ss.label || "").match(/Part\s*(\d)(\s*\+\s*\d)?/i);
          if (!m) return;
          const n = m[1];
          if (skill === "reading") {
            part = n === "1" ? "part1" : n === "2" ? "part2" : n === "4" ? "part3" : n === "5" ? "part4" : null;
          } else {
            part = `part${n}`;
          }
        }
        if (!part) return;
        if (!r.total || r.total <= 0 || r.score > r.total) return;
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
