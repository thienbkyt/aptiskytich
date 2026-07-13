import { supabase } from "@/integrations/supabase/client";

/**
 * Safety-net queue: when a live AI grade-exam call fails (network, 500,
 * timeout), persist the exact request payload into public.grading_jobs so
 * the background worker (process-grading-jobs) can retry it. This is the
 * "don't lose the submission" guarantee for Phase 1a — the worker stores the
 * successful response in grading_jobs.raw_response; the client re-consumes it
 * on next visit / poll to finalize question_gradings + skill_results.
 *
 * Safe to call from anywhere — silently no-ops when user is signed out.
 */
export async function enqueueGradingFallback(args: {
  skill: "speaking" | "writing";
  partType: string;
  testResultId?: string | null;
  payload: Record<string, any>;
  lastError?: string;
}): Promise<{ id: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null };

    const { data, error } = await (supabase as any)
      .from("grading_jobs")
      .insert({
        user_id: user.id,
        test_result_id: args.testResultId ?? null,
        skill: args.skill,
        part: args.partType,
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        payload: args.payload,
        last_error: args.lastError ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[enqueueGradingFallback] insert failed:", error);
      return { id: null };
    }

    // Best-effort: kick the worker immediately (cron is the guaranteed path).
    supabase.functions.invoke("process-grading-jobs", { body: {} }).catch(() => {});

    return { id: data?.id ?? null };
  } catch (e) {
    console.warn("[enqueueGradingFallback] unexpected error:", e);
    return { id: null };
  }
}
