import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toScaledScore, getSkillBand } from "@/data/questions";

const BAND_TO_NUM: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5, C1: 5 };
const NUM_TO_BAND = ["A0", "A1", "A2", "B1", "B2", "C"];

type SkillAgg = { correct: number; total: number };
type OfficialScore = { s50: number; cefr: string | null };

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
        supabase.from("writing_skill_results").select("full_test_session_id, scale50, cefr").eq("user_id", user.id).not("full_test_session_id", "is", null),
        supabase.from("speaking_skill_results").select("full_test_session_id, scale50, cefr").eq("user_id", user.id).not("full_test_session_id", "is", null),
      ]);
      const officialWriting = new Map<string, OfficialScore>();
      const officialSpeaking = new Map<string, OfficialScore>();
      const collect = (list: any[] | null, target: Map<string, OfficialScore>) => {
        (list || []).forEach((r: any) => {
          const sid = r.full_test_session_id;
          const s50 = Number(r.scale50);
          if (!sid || !Number.isFinite(s50) || s50 <= 0) return;
          const prev = target.get(sid);
          if (prev === undefined || s50 > prev.s50) {
            target.set(sid, { s50: Math.round(s50), cefr: r.cefr ? String(r.cefr) : null });
          }
        });
      };
      collect(wsr as any[], officialWriting);
      collect(ssr as any[], officialSpeaking);

      const sessions = new Map<string, {
        ftid: string;
        agg: Map<string, SkillAgg>;
        official: Map<string, OfficialScore>;
      }>();
      (rows || []).forEach((r: any) => {
        const sid = r.full_test_session_id, ftid = r.full_test_id, sk = r.skill_scores?.skill;
        if (!sid || !ftid || !sk) return;
        // Phiên Full Part cũng ghi full_test_session_id — loại ra.
        if (r.skill_scores?.fullPartSession) return;
        const s = sessions.get(sid) || { ftid, agg: new Map(), official: new Map() };
        if (sk === "speaking" || sk === "writing") {
          const official = (sk === "writing" ? officialWriting : officialSpeaking).get(sid);
          if (!official) return;
          s.official.set(sk, official);
        } else if (sk === "reading" || sk === "listening") {
          const c = Number(r.skill_scores?.correct) || 0;
          const t = Number(r.skill_scores?.total) || 0;
          const existing = s.agg.get(sk) || { correct: 0, total: 0 };
          existing.correct += c;
          existing.total += t;
          s.agg.set(sk, existing);
        } else {
          return;
        }
        sessions.set(sid, s);
      });

      const best = new Map<string, number>();
      sessions.forEach(({ ftid, agg, official }) => {
        const skillBands = new Map<string, string>();
        (["listening", "reading"] as const).forEach((sk) => {
          const a = agg.get(sk);
          if (!a || a.total <= 0) return;
          const scaled = toScaledScore(a.correct, a.total);
          skillBands.set(sk, getSkillBand(scaled, sk));
        });
        (["speaking", "writing"] as const).forEach((sk) => {
          const o = official.get(sk);
          if (!o) return;
          const band = o.cefr && BAND_TO_NUM[o.cefr] !== undefined ? o.cefr : getSkillBand(o.s50, sk);
          skillBands.set(sk, band);
        });
        if (skillBands.size < 4) return; // chỉ tính khi đủ 4 kỹ năng
        const nums: number[] = [];
        (["listening", "reading", "speaking", "writing"] as const).forEach((sk) => {
          nums.push(BAND_TO_NUM[skillBands.get(sk)!] ?? 0);
        });
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
