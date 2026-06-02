import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SkillFullSetItem {
  fullTestId: string;
  title: string;
  partCount: number;
  parts: string[];
}

/**
 * Fetches published exam_sets grouped by full_test_id for a specific skill.
 * Returns groups that have at least 2 parts (to qualify as "full practice").
 */
export const useSkillFullSets = (skill: string) => {
  const [sets, setSets] = useState<SkillFullSetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Include ALL merges (Full Part + Full Test) for this skill, so the per-skill
      // Full Part section shows every grouped set of parts (e.g. Đề 01 ghép Full Test
      // vẫn xuất hiện trong Full Part của Listening/Reading/...).
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, full_test_id, full_test_title, part, skill, full_test_category")
        .eq("skill", skill)
        .eq("is_published", true)
        .not("full_test_id", "is", null)
        .order("part", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by full_test_id
      const grouped = new Map<string, { title: string; parts: Set<string> }>();
      for (const row of data) {
        if (!row.full_test_id) continue;
        if (!grouped.has(row.full_test_id)) {
          grouped.set(row.full_test_id, {
            title: row.full_test_title || "Full Practice",
            parts: new Set(),
          });
        }
        grouped.get(row.full_test_id)!.parts.add(row.part);
      }

      const result: SkillFullSetItem[] = [];
      for (const [ftId, info] of grouped) {
        const partsArr = Array.from(info.parts).sort();
        // Only include sets with 2+ parts
        if (partsArr.length >= 2) {
          result.push({
            fullTestId: ftId,
            title: info.title,
            partCount: partsArr.length,
            parts: partsArr,
          });
        }
      }

      const numOf = (t: string) => {
        const m = t.match(/\d+/);
        return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
      };
      result.sort((a, b) => {
        const na = numOf(a.title), nb = numOf(b.title);
        if (na !== nb) return na - nb;
        return a.title.localeCompare(b.title);
      });

      setSets(result);
      setLoading(false);
    })();
  }, [skill]);

  return { sets, loading };
};
