import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { useUserGoal } from "@/hooks/useUserGoal";
import { vnDaysUntil, vnTodayISO } from "@/lib/vnDate";
import { readingPartLabel, normalizePart } from "@/hooks/useExamSets";
import { suggestionRoute } from "@/hooks/useDailySuggestions";

/**
 * Lộ trình Kỳ Tích (Dashboard): Mục tiêu → Thi thử đầu vào → Reading → Listening →
 * Writing → Speaking (đề key Cao → Vừa → Thấp) → Key ngày thi (chỉ mở trước ngày thi 1 ngày)
 * → Về đích (thi thử full).
 *
 * Dữ liệu đề key lấy qua RPC `get_learning_path` (security definer): tài khoản Free chỉ
 * thấy tên/ID đề miễn phí, đề Pro bị che (locked) nhưng vẫn được đếm.
 */

export type PathSkill = "reading" | "listening" | "writing" | "speaking";
export type Tier = "high" | "medium" | "low";
export const PATH_SKILLS: PathSkill[] = ["reading", "listening", "writing", "speaking"];
export const TIERS: Tier[] = ["high", "medium", "low"];
export const SKILL_VI: Record<PathSkill, string> = {
  reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking",
};
export const TIER_VI: Record<Tier, string> = { high: "Cao", medium: "Vừa", low: "Thấp" };

export interface PathItem {
  examSetId: string | null;
  title: string | null;
  skill: PathSkill;
  part: string;
  partLabel: string;
  priority: Tier;
  sortOrder: number;
  locked: boolean;
  done: boolean;
  route: string | null;
}

export interface TierStat { total: number; done: number; locked: number; open: number }
export interface SkillStat {
  skill: PathSkill;
  total: number;
  done: number;
  locked: number;
  /** đề còn làm được (không khoá, chưa làm) */
  open: number;
  tiers: Record<Tier, TierStat>;
  next: PathItem[];
  /** xong phần làm được (open = 0) */
  complete: boolean;
}

export type StepKey = "goal" | "placement" | PathSkill | "examKey" | "finish";
export const STEP_ORDER: StepKey[] = ["goal", "placement", ...PATH_SKILLS, "examKey", "finish"];

export interface PlacementInfo {
  date: string;
  chips: Array<{ label: string; value: string }>;
}

export interface LearningPathData {
  loading: boolean;
  isPro: boolean;
  goal: ReturnType<typeof useUserGoal>["goal"];
  saveGoal: ReturnType<typeof useUserGoal>["saveGoal"];
  todayCount: number;
  daysToExam: number | null;
  keyDate: string | null;
  skills: Record<PathSkill, SkillStat>;
  totals: { total: number; done: number; locked: number; open: number };
  placementDone: boolean;
  placementSkipped: boolean;
  placement: PlacementInfo | null;
  examKey: { date: string; published: boolean; items: PathItem[]; open: number; locked: number; total: number } | null;
  current: StepKey;
  milestones: string[];
  skipPlacement: () => Promise<void>;
  markMilestone: (m: string) => Promise<void>;
}

const partLabelFor = (skill: string, part: string) =>
  skill === "reading" ? readingPartLabel(part) : normalizePart(part).replace(/^part(\d+)$/i, "Part $1");

const tierRank = (t: Tier) => TIERS.indexOf(t);

function toItems(rows: any[]): PathItem[] {
  return (rows || [])
    .filter((r) => PATH_SKILLS.includes(String(r.skill) as PathSkill) && TIERS.includes(String(r.priority) as Tier))
    .map((r) => ({
      examSetId: r.exam_set_id ?? null,
      title: r.title ?? null,
      skill: r.skill as PathSkill,
      part: String(r.part ?? ""),
      partLabel: partLabelFor(String(r.skill), String(r.part ?? "")),
      priority: r.priority as Tier,
      sortOrder: Number(r.sort_order ?? 0),
      locked: !!r.locked,
      done: !!r.done,
      route: r.exam_set_id ? suggestionRoute(r.skill, r.exam_set_id) : null,
    }));
}

function sortForPath(a: PathItem, b: PathItem) {
  return (
    PATH_SKILLS.indexOf(a.skill) - PATH_SKILLS.indexOf(b.skill) ||
    tierRank(a.priority) - tierRank(b.priority) ||
    a.sortOrder - b.sortOrder
  );
}

function emptyTier(): TierStat { return { total: 0, done: 0, locked: 0, open: 0 }; }

export function buildSkills(items: PathItem[]): Record<PathSkill, SkillStat> {
  const out = {} as Record<PathSkill, SkillStat>;
  for (const sk of PATH_SKILLS) {
    const list = items.filter((i) => i.skill === sk).sort(sortForPath);
    const tiers = { high: emptyTier(), medium: emptyTier(), low: emptyTier() } as Record<Tier, TierStat>;
    for (const it of list) {
      const t = tiers[it.priority];
      t.total += 1;
      if (it.done) t.done += 1;
      else if (it.locked) t.locked += 1;
      else t.open += 1;
    }
    const open = list.filter((i) => !i.done && !i.locked);
    out[sk] = {
      skill: sk,
      total: list.length,
      done: list.filter((i) => i.done).length,
      locked: list.filter((i) => !i.done && i.locked).length,
      open: open.length,
      tiers,
      next: open.slice(0, 3),
      complete: open.length === 0,
    };
  }
  return out;
}

const LS_KEY = (uid: string) => `kt_lp_state:${uid}`;

export function useLearningPath(): LearningPathData {
  const { user } = useAuth();
  const { isPro, loading: tierLoading } = useIsPro();
  const { goal, todayCount, hasFullTest, loading: goalLoading, saveGoal } = useUserGoal();
  const qc = useQueryClient();
  const uid = user?.id ?? null;
  const today = vnTodayISO();
  const daysToExam = goal?.exam_date ? vnDaysUntil(goal.exam_date) : null;

  // Làm xong bài → cập nhật tiến độ ngay.
  useEffect(() => {
    const onSaved = () => qc.invalidateQueries({ queryKey: ["learning-path"] });
    window.addEventListener("exam-result-saved", onSaved);
    return () => window.removeEventListener("exam-result-saved", onSaved);
  }, [qc]);

  const pathQ = useQuery({
    queryKey: ["learning-path", uid, today, isPro],
    enabled: !!uid && !tierLoading,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_learning_path", { p_date: today, p_exact: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      return { keyDate: rows[0]?.key_date ?? null, items: toItems(rows) };
    },
  });

  const examKeyQ = useQuery({
    queryKey: ["learning-path-exam", uid, goal?.exam_date, isPro],
    enabled: !!uid && !tierLoading && daysToExam === 1 && !!goal?.exam_date,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_learning_path", { p_date: goal!.exam_date, p_exact: true });
      if (error) throw error;
      return toItems((data || []) as any[]).sort(sortForPath);
    },
  });

  const stateQ = useQuery({
    queryKey: ["learning-path-state", uid],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let local: { skipped?: boolean; milestones?: string[] } = {};
      try { local = JSON.parse(localStorage.getItem(LS_KEY(uid!)) || "{}"); } catch { /* noop */ }
      const { data } = await (supabase as any)
        .from("learning_path_state")
        .select("placement_skipped_at, milestones")
        .eq("user_id", uid)
        .maybeSingle();
      return {
        skipped: !!data?.placement_skipped_at || !!local.skipped,
        milestones: Array.from(new Set([...(data?.milestones || []), ...(local.milestones || [])])) as string[],
      };
    },
  });

  // Bài thi thử full gần nhất → band từng kỹ năng cho bước "Thi thử đầu vào".
  const placementQ = useQuery({
    queryKey: ["learning-path-placement", uid],
    enabled: !!uid && hasFullTest,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_results")
        .select("full_test_session_id, skill_scores, level, score, total, created_at")
        .eq("user_id", uid!)
        .not("full_test_session_id", "is", null)
        .is("skill_scores->>fullPartSession", null)
        .order("created_at", { ascending: false })
        .limit(40);
      const rows = (data || []) as any[];
      if (!rows.length) return null;
      const sess = rows[0].full_test_session_id;
      const same = rows.filter((r) => r.full_test_session_id === sess);
      const order = ["grammar_vocab", "grammar", "listening", "reading", "writing", "speaking"];
      const label: Record<string, string> = {
        grammar_vocab: "G&V", grammar: "G&V", listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking",
      };
      const bySkill = new Map<string, string>();
      for (const r of same) {
        const sk = String(r?.skill_scores?.skill || "").toLowerCase();
        if (!sk || bySkill.has(label[sk] || sk)) continue;
        if (r.level) bySkill.set(label[sk] || sk, String(r.level));
      }
      const chips = order
        .map((k) => label[k])
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter((l) => bySkill.has(l))
        .map((l) => ({ label: l, value: bySkill.get(l)! }));
      const d = new Date(same[same.length - 1].created_at);
      const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
      return { date, chips } as PlacementInfo;
    },
  });

  const items = pathQ.data?.items ?? [];
  const skills = buildSkills(items);
  const totals = PATH_SKILLS.reduce(
    (acc, sk) => ({
      total: acc.total + skills[sk].total,
      done: acc.done + skills[sk].done,
      locked: acc.locked + skills[sk].locked,
      open: acc.open + skills[sk].open,
    }),
    { total: 0, done: 0, locked: 0, open: 0 },
  );
  const placementSkipped = !!stateQ.data?.skipped;
  const placementDone = hasFullTest || placementSkipped;

  let examKey: LearningPathData["examKey"] = null;
  if (daysToExam === 1 && goal?.exam_date) {
    const ek = examKeyQ.data ?? [];
    examKey = {
      date: goal.exam_date,
      published: ek.length > 0,
      items: ek,
      total: ek.length,
      open: ek.filter((i) => !i.done && !i.locked).length,
      locked: ek.filter((i) => !i.done && i.locked).length,
    };
  }

  let current: StepKey;
  if (!goal) current = "goal";
  else if (!placementDone) current = "placement";
  else if (daysToExam === 1) current = "examKey";
  else current = PATH_SKILLS.find((sk) => !skills[sk].complete) ?? "finish";

  const writeState = async (patch: { skipped?: boolean; milestones?: string[] }) => {
    if (!uid) return;
    const prev = stateQ.data ?? { skipped: false, milestones: [] };
    const next = {
      skipped: patch.skipped ?? prev.skipped,
      milestones: patch.milestones ?? prev.milestones,
    };
    try { localStorage.setItem(LS_KEY(uid), JSON.stringify(next)); } catch { /* noop */ }
    qc.setQueryData(["learning-path-state", uid], next);
    try {
      await (supabase as any).from("learning_path_state").upsert(
        {
          user_id: uid,
          placement_skipped_at: next.skipped ? new Date().toISOString() : null,
          milestones: next.milestones,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    } catch { /* đã lưu localStorage, không chặn giao diện */ }
  };

  return {
    loading: goalLoading || tierLoading || pathQ.isLoading || stateQ.isLoading,
    isPro,
    goal,
    saveGoal,
    todayCount,
    daysToExam,
    keyDate: pathQ.data?.keyDate ?? null,
    skills,
    totals,
    placementDone,
    placementSkipped,
    placement: placementQ.data ?? null,
    examKey,
    current,
    milestones: stateQ.data?.milestones ?? [],
    skipPlacement: () => writeState({ skipped: true }),
    markMilestone: (m: string) =>
      writeState({ milestones: Array.from(new Set([...(stateQ.data?.milestones ?? []), m])) }),
  };
}
