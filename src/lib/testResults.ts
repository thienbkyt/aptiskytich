import { supabase } from "@/integrations/supabase/client";
import { getLevel } from "@/data/questions";

/**
 * Best-effort persistence of an exam result. Failures are swallowed so
 * the results UI is never blocked by network/RLS issues.
 */
export async function saveTestResult(opts: {
  correct: number;
  total: number;
  skill: string;
  testId?: string | null;
  skillScores?: Record<string, { correct: number; total: number }>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const total = Math.max(opts.total, 0);
    const correct = Math.max(opts.correct, 0);
    const level = total > 0 ? getLevel(correct, total) : "A1";
    await supabase.from("test_results").insert({
      user_id: user.id,
      correct_answers: correct,
      score: correct,
      total: total || 1,
      level,
      test_id: opts.testId ?? null,
      skill_scores: opts.skillScores
        ? (opts.skillScores as any)
        : ({ skill: opts.skill, correct, total } as any),
    });
  } catch (err) {
    console.warn("[saveTestResult] skipped:", err);
  }
}
