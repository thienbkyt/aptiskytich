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

/** Wraps a thenable with a timeout. Rejects (throws) if it doesn't resolve in `ms`. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = "request"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race<T>([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

interface GetFullTestsRow {
  fullTestId: string;
  title: string;
  category: "aptis" | "key" | null;
  examSetIds: string[];
  skills: string[];
  access_tier?: "free" | "pro" | "premium";
  isNew?: boolean;
}

/**
 * Fetches published Full Tests via the public.get_full_tests RPC (single call,
 * SECURITY DEFINER so anonymous users get the same payload).
 */
export const useFullTests = (category: FullTestCategory = "aptis") => {
  const [tests, setTests] = useState<FullTestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await withTimeout(
        supabase.rpc("get_full_tests", { p_category: category }),
        12000,
        "get_full_tests",
      );

      const { data, error: rpcErr } = res;
      const rows = (data ?? []) as unknown as GetFullTestsRow[];
      if (rpcErr || !rows.length) {
        setTests([]);
        return;
      }

      const requiredSkills = ["speaking", "listening", "grammar_vocab", "reading", "writing"];
      const result: FullTestItem[] = [];
      for (const row of rows) {
        const skills = Array.isArray(row.skills) ? row.skills : [];
        const isReady = requiredSkills.every((s) => skills.includes(s));
        if (!isReady) continue;
        result.push({
          fullTestId: row.fullTestId,
          title: row.title,
          skills,
          skillCount: skills.length,
          examSetIds: Array.isArray(row.examSetIds) ? row.examSetIds : [],
          isReady,
          category: row.category ?? null,
          access_tier: row.access_tier ?? "pro",
          isNew: row.isNew ?? false,
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
