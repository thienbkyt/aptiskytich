import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FullTestItem {
  fullTestId: string;
  title: string;
  skills: string[];
  skillCount: number;
  isReady: boolean; // has all 5 skills
  category: "aptis" | "key" | null;
}

export type FullTestCategory = "aptis" | "key";

/**
 * Fetches published Full Tests grouped by full_test_id, filtered by category.
 * - "aptis": rows with full_test_category = 'aptis' OR null (legacy data)
 * - "key": rows with full_test_category = 'key'
 */
export const useFullTests = (category: FullTestCategory = "aptis") => {
  const [tests, setTests] = useState<FullTestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Only include rows that were merged via "Ghép Full Test" (have explicit full_test_category).
      // Single-skill Full Part merges leave full_test_category = NULL and must NOT show here.
      const query = supabase
        .from("exam_sets")
        .select("id, full_test_id, full_test_title, skill, is_published, full_test_category")
        .not("full_test_id", "is", null)
        .eq("is_published", true)
        .eq("full_test_category", category)
        .order("created_at", { ascending: true });

      const { data, error } = await query;

      if (error || !data) {
        setLoading(false);
        setTests([]);
        return;
      }

      const grouped = new Map<string, { title: string; skills: Set<string>; category: "aptis" | "key" | null }>();
      for (const row of data) {
        if (!row.full_test_id) continue;
        if (!grouped.has(row.full_test_id)) {
          grouped.set(row.full_test_id, {
            title: row.full_test_title || "Full Test",
            skills: new Set(),
            category: (row.full_test_category as "aptis" | "key" | null) ?? null,
          });
        }
        grouped.get(row.full_test_id)!.skills.add(row.skill);
      }

      const requiredSkills = ["speaking", "listening", "grammar_vocab", "reading", "writing"];
      const result: FullTestItem[] = [];
      for (const [ftId, info] of grouped) {
        const skillArr = Array.from(info.skills);
        const isReady = requiredSkills.every((s) => skillArr.includes(s));
        if (!isReady) continue;
        result.push({
          fullTestId: ftId,
          title: info.title,
          skills: skillArr,
          skillCount: skillArr.length,
          isReady,
          category: info.category,
        });
      }

      setTests(result);
      setLoading(false);
    })();
  }, [category]);

  return { tests, loading };
};
