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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onSaved = () => setRefreshKey((k) => k + 1);
    window.addEventListener("exam-result-saved", onSaved);
    return () => window.removeEventListener("exam-result-saved", onSaved);
  }, []);

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
      // Nguồn điểm Writing/Speaking = bảng kết quả kỹ năng đã lưu (không tính lại).
      const [{ data: wsr }, { data: ssr }] = await Promise.all([
        supabase.from("writing_skill_results").select("full_test_session_id, scale50").eq("user_id", user.id).not("full_test_session_id", "is", null),
        supabase.from("speaking_skill_results").select("full_test_session_id, scale50").eq("user_id", user.id).not("full_test_session_id", "is", null),
      ]);
      const officialWriting = new Map<string, number>();
      const officialSpeaking = new Map<string, number>();
      const collect = (list: any[] | null, target: Map<string, number>) => {
        (list || []).forEach((r: any) => {
          const sid = r.full_test_session_id;
          const s50 = Number(r.scale50);
          if (!sid || !Number.isFinite(s50) || s50 <= 0) return;
          const prev = target.get(sid);
          if (prev === undefined || s50 > prev) target.set(sid, Math.round(s50));
        });
      };
      collect(wsr as any[], officialWriting);
      collect(ssr as any[], officialSpeaking);

      const sessions = new Map<string, { ftid: string; skills: Map<string, number> }>();
      (rows || []).forEach((r: any) => {
        const sid = r.full_test_session_id, ftid = r.full_test_id, sk = r.skill_scores?.skill;
        if (!sid || !ftid || !sk) return;
        // Phiên Full Part cũng ghi full_test_session_id — loại ra.
        if (r.skill_scores?.fullPartSession) return;
        let scaled = 0;
        if (sk === "speaking" || sk === "writing") {
          const s50 = (sk === "writing" ? officialWriting : officialSpeaking).get(sid);
          if (s50 === undefined) return;
          scaled = s50;
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
  }, [user, authLoading, refreshKey]);

  return { bands };
};
