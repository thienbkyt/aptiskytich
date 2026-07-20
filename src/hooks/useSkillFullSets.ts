import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compareExamItems } from "@/lib/sortExamSets";

export interface SkillFullSetItem {
  fullTestId: string;
  title: string;
  partCount: number;
  parts: string[];
  examSetIds: string[];
  questionCount: number;
  /** Lowest tier of constituent exam_sets (most accessible). */
  access_tier?: "free" | "pro" | "premium";
  /** True if at least one constituent exam_set is currently within its new_until window. */
  isNew?: boolean;
}


/**
 * Fetches published exam_sets grouped by full_test_id for a specific skill.
 * Returns groups that have at least 2 parts (to qualify as "full practice").
 */
export const useSkillFullSets = (skill: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ["skillFullSets", skill],
    queryFn: async (): Promise<SkillFullSetItem[]> => {
      // Only include single-skill Full Part merges (full_test_category IS NULL).
      // Multi-skill Full Tests (category = 'aptis' / 'key') belong to the Aptis/Key
      // Full Test section, not to per-skill Full Part practice.
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, full_test_id, full_test_title, part, skill, full_test_category, access_tier, question_count, new_until")
        .eq("skill", skill)
        .eq("is_published", true)
        .not("full_test_id", "is", null)
        .is("full_test_category", null)
        .order("part", { ascending: true });

      if (error || !data) return [];

      // Group by full_test_id
      // Full Part requires user to access ALL constituent parts → gate by MOST restrictive tier.
      const grouped = new Map<string, { title: string; parts: Set<string>; ids: string[]; rows: { id: string; part: string; qc: number }[]; maxTier: "free" | "pro" | "premium"; isNew: boolean }>();
      const rankT = (t: string) => t === "premium" ? 2 : t === "pro" ? 1 : 0;
      const now = Date.now();
      for (const row of data as any[]) {
        if (!row.full_test_id) continue;
        if (!grouped.has(row.full_test_id)) {
          grouped.set(row.full_test_id, {
            title: row.full_test_title || "Full Practice",
            parts: new Set(),
            ids: [],
            rows: [],
            maxTier: "free",
            isNew: false,
          });
        }
        const g = grouped.get(row.full_test_id)!;
        g.parts.add(row.part);
        g.ids.push(row.id);
        g.rows.push({ id: row.id, part: row.part, qc: Number(row.question_count) || 0 });
        const rt = (row.access_tier === "free" || row.access_tier === "pro" || row.access_tier === "premium") ? row.access_tier : "pro";
        if (rankT(rt) > rankT(g.maxTier)) g.maxTier = rt;
        if (row.new_until && new Date(row.new_until).getTime() > now) g.isNew = true;
      }

      const result: SkillFullSetItem[] = [];
      for (const [ftId, info] of grouped.entries()) {
        const partsArr = Array.from(info.parts).sort();
        if (partsArr.length < 2) continue;
        let questionCount = 0;
        if (skill === "grammar_vocab") {
          const isVocab = (p: string) => /vocab/i.test(p);
          const vocabPartCount = partsArr.filter(isVocab).length;
          const grammarQ = info.rows.filter((r) => !isVocab(r.part)).reduce((sum, r) => sum + r.qc, 0);
          questionCount = grammarQ + vocabPartCount;
        } else {
          questionCount = info.rows.reduce((sum, r) => sum + r.qc, 0);
        }
        result.push({
          fullTestId: ftId,
          title: info.title,
          partCount: partsArr.length,
          parts: partsArr,
          examSetIds: info.ids,
          questionCount,
          access_tier: info.maxTier,
          isNew: info.isNew,
        });
      }

      result.sort((a, b) =>
        compareExamItems({ title: a.title, access_tier: a.access_tier, isNew: a.isNew }, { title: b.title, access_tier: b.access_tier, isNew: b.isNew }),
      );

      return result;

    },
  });

  return { sets: data ?? [], loading: isLoading };
};
