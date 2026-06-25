import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FullTestItem {
  fullTestId: string;
  title: string;
  skills: string[];
  skillCount: number;
  isReady: boolean; // has all 5 skills
  category: "aptis" | "key" | null;
  /** 'free' if ANY constituent published exam_set is free, else 'pro'. */
  access_tier?: "free" | "pro" | "premium";
}

export type FullTestCategory = "aptis" | "key";

/**
 * Fetches published Full Tests from the new full_tests table (linked to exam_sets via full_test_members).
 * This keeps Full Test as a layer on top of exam_sets so per-skill Full Part merges stay intact.
 */
export const useFullTests = (category: FullTestCategory = "aptis") => {
  const [tests, setTests] = useState<FullTestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: ftRows, error: ftErr } = await supabase
        .from("full_tests")
        .select("id, title, category, is_published")
        .eq("category", category)
        .eq("is_published", true)
        .order("created_at", { ascending: true });

      if (ftErr || !ftRows || ftRows.length === 0) {
        setLoading(false);
        setTests([]);
        return;
      }

      const ftIds = ftRows.map((r) => r.id);
      const { data: members } = await supabase
        .from("full_test_members")
        .select("full_test_id, exam_set_id")
        .in("full_test_id", ftIds);

      const setIds = Array.from(new Set((members || []).map((m) => m.exam_set_id)));
      const { data: sets } = await supabase
        .from("exam_sets")
        .select("id, skill, is_published, access_tier")
        .in("id", setIds.length ? setIds : ["00000000-0000-0000-0000-000000000000"]);

      const setSkillMap = new Map<string, { skill: string; published: boolean; tier: string }>();
      for (const s of (sets || []) as any[]) {
        setSkillMap.set(s.id, { skill: s.skill, published: s.is_published, tier: s.access_tier ?? "pro" });
      }

      const requiredSkills = ["speaking", "listening", "grammar_vocab", "reading", "writing"];
      const result: FullTestItem[] = [];
      for (const ft of ftRows) {
        const memberIds = (members || []).filter((m) => m.full_test_id === ft.id).map((m) => m.exam_set_id);
        const skillsSet = new Set<string>();
        let anyFree = false;
        for (const sid of memberIds) {
          const info = setSkillMap.get(sid);
          if (info && info.published) {
            skillsSet.add(info.skill);
            if (info.tier === "free") anyFree = true;
          }
        }
        const skillArr = Array.from(skillsSet);
        const isReady = requiredSkills.every((s) => skillArr.includes(s));
        if (!isReady) continue;
        result.push({
          fullTestId: ft.id,
          title: ft.title,
          skills: skillArr,
          skillCount: skillArr.length,
          isReady,
          category: (ft.category as "aptis" | "key") ?? null,
          access_tier: anyFree ? "free" : "pro",
        });
      }

      setTests(result);
      setLoading(false);
    })();
  }, [category]);

  return { tests, loading };
};
