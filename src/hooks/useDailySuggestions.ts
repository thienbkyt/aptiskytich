import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { readingPartLabel, normalizePart } from "@/hooks/useExamSets";
import { toScaledScore, getSkillBand, getLevel } from "@/data/questions";

export type KeyPriority = "high" | "medium" | "low" | "backup";

const PRIORITY_RANK: KeyPriority[] = ["high", "medium", "low", "backup"];
const PRIORITY_VI: Record<KeyPriority, string> = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
  backup: "Backup",
};

const SKILL_LABEL: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar_vocab: "Grammar & Vocab",
  grammar: "Grammar & Vocab",
  writing: "Writing",
  speaking: "Speaking",
};

const BAND_TO_NUM: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };

export interface DailySuggestion {
  examSetId: string;
  title: string;
  skill: string;
  skillLabel: string;
  partLabel: string;
  reason: string;
  route: string;
}

export interface DailySuggestionsResult {
  suggestions: DailySuggestion[];
  loading: boolean;
  isPro: boolean;
  /** true when nothing is left undone in the whole library */
  libraryCleared: boolean;
  /** free user cleared every free set, but paid sets remain */
  freeExhausted: boolean;
}

/** Route used by each skill's exam list. */
export function suggestionRoute(skill: string | null | undefined, setId: string): string {
  const s = (skill || "").toLowerCase();
  if (s === "reading") return `/reading?set=${setId}&jump=1`;
  if (s === "listening") return `/listening?set=${setId}&jump=1`;
  if (s === "grammar_vocab" || s === "grammar") return `/grammar?set=${setId}&jump=1`;
  if (s === "writing") return `/writing?set=${setId}&jump=1`;
  if (s === "speaking") return `/speaking?set=${setId}&jump=1`;
  return `/thi-thu`;
}

const partLabelFor = (skill: string, part: string) =>
  skill === "reading" ? readingPartLabel(part) : normalizePart(part).replace(/^part(\d+)$/i, "Part $1");

/**
 * "Gợi ý bài hôm nay": key dự đoán (Pro) → kỹ năng yếu nhất → đề mới nhất.
 * Tách riêng để lượt sau tái dùng cho notification nhắc học.
 */
export function useDailySuggestions(limit: number): DailySuggestionsResult {
  const { user } = useAuth();
  const { isPro, loading: tierLoading } = useIsPro();
  const max = Math.max(1, Math.min(3, limit || 1));

  const { data, isLoading } = useQuery({
    queryKey: ["daily-suggestions", user?.id, isPro, max],
    enabled: !!user && !tierLoading,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const uid = user!.id;
      // VN day (same source of truth as saveExamResult.ts) so the key matches the key page.
      const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

      const [attemptRes, setsRes, wsrRes, ssrRes] = await Promise.all([
        supabase.from("test_results").select("exam_set_id, skill_scores, score, total").eq("user_id", uid),
        supabase
          .from("exam_sets")
          .select("id, title, skill, part, access_tier, created_at")
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
        supabase.from("writing_skill_results").select("scale50").eq("user_id", uid),
        supabase.from("speaking_skill_results").select("scale50").eq("user_id", uid),
      ]);

      // Same condition as PredictionKeyView's `tried.add`: an abandoned attempt doesn't count.
      const attempted = new Set<string>();
      (attemptRes.data || []).forEach((r: any) => {
        if (r.exam_set_id && Number(r.total) > 0) attempted.add(r.exam_set_id);
      });

      const publishedSets = (setsRes.data || []) as any[];
      const allSets = publishedSets.filter((s) => (isPro ? true : !s.access_tier || s.access_tier === "free"));
      const setById = new Map<string, any>(allSets.map((s) => [s.id, s]));

      // ── Bands theo kỹ năng (cùng nguồn với "Tiến bộ theo kỹ năng") ──
      const agg: Record<string, { correct: number; total: number }> = {};
      (attemptRes.data || []).forEach((r: any) => {
        const ss = r.skill_scores;
        if (!ss || typeof ss !== "object" || ss.mode === "marathon") return;
        const sk = String(ss.skill || "").toLowerCase() === "grammar" ? "grammar_vocab" : ss.skill;
        const t = Number(ss.total) || 0;
        if (!sk || t <= 0) return;
        agg[sk] = agg[sk] || { correct: 0, total: 0 };
        agg[sk].correct += Number(ss.correct) || 0;
        agg[sk].total += t;
      });
      const avg50 = (rows: any[] | null) => {
        const vals = (rows || []).map((r: any) => Number(r.scale50)).filter((n) => Number.isFinite(n) && n > 0);
        if (!vals.length) return undefined;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      };

      const bandNum: Record<string, number> = {};
      const bandLabel: Record<string, string> = {};
      const setBand = (sk: string, band: string) => {
        const norm = band === "C2" ? "C1" : band;
        bandLabel[sk] = band;
        bandNum[sk] = BAND_TO_NUM[norm] ?? 0;
      };
      (["reading", "listening"] as const).forEach((sk) => {
        const a = agg[sk];
        if (!a || a.total <= 0) return;
        setBand(sk, getSkillBand(toScaledScore(a.correct, a.total), sk));
      });
      // Grammar & Vocab has no Aptis scaled band table — dashboard uses the % level.
      {
        const a = agg["grammar_vocab"];
        if (a && a.total > 0) setBand("grammar_vocab", getLevel(a.correct, a.total));
      }
      const w = avg50(wsrRes.data as any[]);
      if (w !== undefined) setBand("writing", getSkillBand(w, "writing"));
      const sp = avg50(ssrRes.data as any[]);
      if (sp !== undefined) setBand("speaking", getSkillBand(sp, "speaking"));

      const picked: DailySuggestion[] = [];
      const used = new Set<string>();
      const push = (set: any, reason: string) => {
        if (!set || used.has(set.id) || picked.length >= max) return;
        used.add(set.id);
        picked.push({
          examSetId: set.id,
          title: set.title,
          skill: set.skill,
          skillLabel: SKILL_LABEL[String(set.skill).toLowerCase()] || set.skill,
          partLabel: partLabelFor(String(set.skill).toLowerCase(), String(set.part || "")),
          reason,
          route: suggestionRoute(set.skill, set.id),
        });
      };

      // ── B1-B3: key dự đoán hôm nay (chỉ Pro/Premium) ──
      if (isPro) {
        const { data: keyRow } = await supabase
          .from("prediction_keys")
          .select("id, date")
          .eq("is_published", true)
          .lte("date", todayStr)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (keyRow?.id) {
          const { data: items } = await supabase
            .from("prediction_items")
            .select("exam_set_id, priority, sort_order")
            .eq("key_id", keyRow.id);
          const rows = ((items || []) as any[])
            .map((it) => ({
              exam_set_id: it.exam_set_id as string,
              priority: (PRIORITY_RANK.includes(String(it.priority).toLowerCase() as KeyPriority)
                ? String(it.priority).toLowerCase()
                : "backup") as KeyPriority,
              sort_order: Number(it.sort_order) || 0,
            }))
            .filter((it) => it.exam_set_id && !attempted.has(it.exam_set_id) && setById.has(it.exam_set_id))
            .sort((a, b) => {
              const d = PRIORITY_RANK.indexOf(a.priority) - PRIORITY_RANK.indexOf(b.priority);
              if (d !== 0) return d;
              if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
              return a.exam_set_id.localeCompare(b.exam_set_id);
            });
          for (const it of rows) {
            if (picked.length >= max) break;
            push(setById.get(it.exam_set_id), `Key hôm nay · ưu tiên ${PRIORITY_VI[it.priority]}`);
          }
        }
      }

      // ── B4: kỹ năng chưa luyện bao giờ → rồi tới band thấp nhất ──
      const undone = allSets.filter((s) => !attempted.has(s.id));
      if (picked.length < max) {
        const ALL_SKILLS = ["reading", "listening", "grammar_vocab", "writing", "speaking"] as const;
        const poolFor = (sk: string) =>
          undone.filter((s) => {
            const ss = String(s.skill).toLowerCase();
            return ss === sk || (sk === "grammar_vocab" && ss === "grammar");
          });
        // Chưa có dữ liệu = yếu nhất tuyệt đối.
        const untouched = ALL_SKILLS.filter((sk) => bandNum[sk] === undefined);
        const ranked = ALL_SKILLS.filter((sk) => bandNum[sk] !== undefined).sort(
          (a, b) => bandNum[a] - bandNum[b],
        );
        for (const sk of untouched) {
          if (picked.length >= max) break;
          for (const s of poolFor(sk)) {
            if (picked.length >= max) break;
            push(s, "Bạn chưa luyện kỹ năng này bao giờ");
          }
        }
        for (const sk of ranked) {
          if (picked.length >= max) break;
          for (const s of poolFor(sk)) {
            if (picked.length >= max) break;
            push(s, `Kỹ năng yếu nhất của bạn (${bandLabel[sk]})`);
          }
        }
      }

      // ── B5: đề chưa làm bất kỳ, ưu tiên mới import gần đây ──
      if (picked.length < max) {
        for (const s of undone) {
          if (picked.length >= max) break;
          push(s, "Đề mới, bạn chưa làm");
        }
      }

      // Free user hết đề free nhưng kho vẫn còn đề pro → không phải "cày sạch".
      const undoneAll = publishedSets.filter((s) => !attempted.has(s.id));
      return {
        suggestions: picked,
        libraryCleared: undoneAll.length === 0,
        freeExhausted: !isPro && undone.length === 0 && undoneAll.length > 0,
      };
    },
  });

  return {
    suggestions: data?.suggestions ?? [],
    libraryCleared: !!data?.libraryCleared,
    freeExhausted: !!data?.freeExhausted,
    loading: isLoading || tierLoading,
    isPro,
  };
}
