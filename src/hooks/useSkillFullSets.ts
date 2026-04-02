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
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, full_test_id, full_test_title, part, skill")
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

      setSets(result);
      setLoading(false);
    })();
  }, [skill]);

  return { sets, loading };
};
