import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toScaledScore, getSkillBand } from "@/data/questions";

const BAND_TO_NUM: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };
const NUM_TO_BAND = ["A0", "A1", "A2", "B1", "B2", "C"];

/** Best overall CEFR band per full_test_id for the signed-in user. */
export const useUserFullTestBands = () => {
  const { user, loading: authLoading } = useAuth();
  const [bands, setBands] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setBands(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("test_results")
        .select("id, full_test_id, full_test_session_id, skill_scores")
        .eq("user_id", user.id)
        .not("full_test_session_id", "is", null);
      const [{ data: wg }, { data: sg }] = await Promise.all([
        supabase.from("writing_question_gradings").select("test_result_id, part_score, max_points").eq("user_id", user.id),
        supabase.from("speaking_question_gradings").select("test_result_id, part_score, max_points").eq("user_id", user.id),
      ]);
      const graded = new Map<string, { score: number; max: number }>();
      [...(wg || []), ...(sg || [])].forEach((g: any) => {
        if (!g.test_result_id) return;
        const e = graded.get(g.test_result_id) || { score: 0, max: 0 };
        e.score += Number(g.part_score) || 0; e.max += Number(g.max_points) || 0;
        graded.set(g.test_result_id, e);
      });
      const sessions = new Map<string, { ftid: string; skills: Map<string, number> }>();
      (rows || []).forEach((r: any) => {
        const sid = r.full_test_session_id, ftid = r.full_test_id, sk = r.skill_scores?.skill;
        if (!sid || !ftid || !sk) return;
        let scaled = 0;
        if (sk === "speaking" || sk === "writing") {
          const g = graded.get(r.id);
          scaled = g && g.max > 0 ? toScaledScore(g.score, g.max) : 0;
        } else if (sk === "reading" || sk === "listening") {
          const c = Number(r.skill_scores?.correct) || 0, t = Number(r.skill_scores?.total) || 0;
          scaled = t > 0 ? toScaledScore(c, t) : 0;
        } else return;
        const s = sessions.get(sid) || { ftid, skills: new Map() };
        s.skills.set(sk, scaled);
        sessions.set(sid, s);
      });
      const best = new Map<string, number>();
      sessions.forEach(({ ftid, skills }) => {
        const nums: number[] = [];
        (["listening", "reading", "speaking", "writing"] as const).forEach((sk) => {
          if (skills.has(sk)) nums.push(BAND_TO_NUM[getSkillBand(skills.get(sk)!, sk)] ?? 0);
        });
        if (nums.length < 4) return; // chỉ tính khi đủ 4 kỹ năng
        const overall = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
        const prev = best.get(ftid);
        if (prev === undefined || overall > prev) best.set(ftid, overall);
      });
      const map = new Map<string, string>();
      best.forEach((num, ftid) => map.set(ftid, NUM_TO_BAND[Math.max(0, Math.min(5, num))]));
      if (!cancelled) setBands(map);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { bands };
};
