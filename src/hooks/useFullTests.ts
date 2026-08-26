import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareExamItems } from "@/lib/sortExamSets";

export interface FullTestItem {
  fullTestId: string;
  title: string;
  skills: string[];
  skillCount: number;
  examSetIds: string[];
  isReady: boolean; // has all 5 skills
  category: "aptis" | "key" | null;
  /** Most restrictive tier among constituent exam_sets (matches useSkillFullSets). */
  access_tier?: "free" | "pro" | "premium";
  /** True if at least one constituent exam_set is currently within its new_until window. */
  isNew?: boolean;
}

export type FullTestCategory = "aptis" | "key";

/** Wraps a promise with a timeout. Rejects (throws) if it doesn't resolve in `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label = "request"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Fetches published Full Tests from the new full_tests table (linked to exam_sets via full_test_members).
 * This keeps Full Test as a layer on top of exam_sets so per-skill Full Part merges stay intact.
 */
export const useFullTests = (category: FullTestCategory = "aptis") => {
  const [tests, setTests] = useState<FullTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const ftRes = await withTimeout(
        supabase
          .from("full_tests")
          .select("id, title, category, is_published")
          .eq("category", category)
          .eq("is_published", true)
          .order("created_at", { ascending: true }),
        12000,
        "full_tests",
      );

      const { data: ftRows, error: ftErr } = ftRes;
      if (ftErr || !ftRows || ftRows.length === 0) {
        setTests([]);
        return;
      }

      const ftIds = ftRows.map((r) => r.id);

      const membersRes = await withTimeout(
        supabase
          .from("full_test_members")
          .select("full_test_id, exam_set_id")
          .in("full_test_id", ftIds),
        12000,
        "full_test_members",
      );
      const { data: members } = membersRes;

      const setIds = Array.from(new Set((members || []).map((m) => m.exam_set_id)));
      const setsRes = await withTimeout(
        supabase
          .from("exam_sets")
          .select("id, skill, is_published, access_tier, new_until")
          .in("id", setIds.length ? setIds : ["00000000-0000-0000-0000-000000000000"]),
        12000,
        "exam_sets",
      );
      const { data: sets } = setsRes;

      const setSkillMap = new Map<string, { skill: string; published: boolean; tier: string; newUntil: string | null }>();
      for (const s of (sets || []) as any[]) {
        setSkillMap.set(s.id, { skill: s.skill, published: s.is_published, tier: s.access_tier ?? "pro", newUntil: s.new_until ?? null });
      }

      const requiredSkills = ["speaking", "listening", "grammar_vocab", "reading", "writing"];
      const rankT = (t: string) => t === "premium" ? 2 : t === "pro" ? 1 : 0;
      const now = Date.now();
      const result: FullTestItem[] = [];
      for (const ft of ftRows) {
        const memberIds = (members || []).filter((m) => m.full_test_id === ft.id).map((m) => m.exam_set_id);
        const skillsSet = new Set<string>();
        let maxTier: "free" | "pro" | "premium" = "free";
        let isNew = false;
        for (const sid of memberIds) {
          const info = setSkillMap.get(sid);
          if (info && info.published) {
            skillsSet.add(info.skill);
            const t = (info.tier === "free" || info.tier === "pro" || info.tier === "premium") ? info.tier : "pro";
            if (rankT(t) > rankT(maxTier)) maxTier = t;
            if (info.newUntil && new Date(info.newUntil).getTime() > now) isNew = true;
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
          examSetIds: memberIds,
          isReady,
          category: (ft.category as "aptis" | "key") ?? null,
          access_tier: maxTier,
          isNew,
        });
      }

      result.sort((a, b) =>
        compareExamItems({ title: a.title, access_tier: a.access_tier, isNew: a.isNew }, { title: b.title, access_tier: b.access_tier, isNew: b.isNew }),
      );

      setTests(result);
    } catch (err) {
      console.error("[useFullTests] fetch failed:", err);
      setError(true);
      setTests([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  const reload = useCallback(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  return { tests, loading, error, reload };
};
