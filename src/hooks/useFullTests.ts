import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FullTestItem {
  fullTestId: string;
  title: string;
  skills: string[];
  skillCount: number;
  isReady: boolean; // has all 5 skills
}

/**
 * Fetches published Full Tests by grouping exam_sets with full_test_id
 */
export const useFullTests = () => {
  const [tests, setTests] = useState<FullTestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, full_test_id, full_test_title, skill, is_published")
        .not("full_test_id", "is", null)
        .eq("is_published", true)
        .order("created_at", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by full_test_id
      const grouped = new Map<string, { title: string; skills: Set<string> }>();
      for (const row of data) {
        if (!row.full_test_id) continue;
        if (!grouped.has(row.full_test_id)) {
          grouped.set(row.full_test_id, {
            title: row.full_test_title || "Full Test",
            skills: new Set(),
          });
        }
        grouped.get(row.full_test_id)!.skills.add(row.skill);
      }

      const requiredSkills = ["speaking", "listening", "grammar_vocab", "reading", "writing"];
      const result: FullTestItem[] = [];
      for (const [ftId, info] of grouped) {
        const skillArr = Array.from(info.skills);
        const isReady = requiredSkills.every((s) => skillArr.includes(s));
        result.push({
          fullTestId: ftId,
          title: info.title,
          skills: skillArr,
          skillCount: skillArr.length,
          isReady,
        });
      }

      setTests(result);
      setLoading(false);
    })();
  }, []);

  return { tests, loading };
};
