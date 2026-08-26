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
  examSetId?: string | null;
  fullTestSessionId?: string | null;
  payload: Record<string, any>;
  lastError?: string;
}): Promise<{ id: string | null; errorCode?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null };

    const enrichedPayload = {
      ...args.payload,
      _meta: {
        examSetId: args.examSetId ?? null,
        fullTestSessionId: args.fullTestSessionId ?? null,
      },
    };

    // Quota + ownership are enforced server-side by this SECURITY DEFINER RPC.
    // Direct inserts into grading_jobs are no longer permitted for clients.
    const { data, error } = await (supabase as any).rpc("enqueue_grading_job", {
      p_skill: args.skill,
      p_part: args.partType,
      p_payload: enrichedPayload,
      p_test_result_id: args.testResultId ?? null,
      p_last_error: args.lastError ?? null,
    });

    if (error) {
      console.warn("[enqueueGradingFallback] enqueue rpc failed:", error);
      return { id: null, errorCode: String((error as any)?.message || "enqueue_failed") };
    }


    // Best-effort: kick the worker immediately (cron is the guaranteed path).
    supabase.functions.invoke("process-grading-jobs", { body: {} }).catch(() => {});

    return { id: (data as string) ?? null };

  } catch (e) {
    console.warn("[enqueueGradingFallback] unexpected error:", e);
    return { id: null };
  }
}
