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

    // A writing job without a test_result_id can never be persisted by the
    // worker (it fails with "writing job missing test_result_id"), so refuse to
    // create it and let the caller surface a real error instead.
    if (args.skill === "writing" && !args.testResultId) {
      console.error("[enqueueGradingFallback] refusing writing job without test_result_id");
      return { id: null, errorCode: "missing_test_result_id" };
    }

    // A speaking job whose recordings never reached storage can only ever be
    // graded as silence — refuse it instead of burning a grading slot.
    if (args.skill === "speaking") {
      const paths = (args.payload as any)?.audioPaths;
      if (Array.isArray(paths) && paths.length > 0 && !paths.some(Boolean)) {
        console.error("[enqueueGradingFallback] refusing speaking job with no uploaded audio");
        return { id: null, errorCode: "no_audio" };
      }
    }

    // Double-submit guard: a job for the same attempt + part created in the last
    // 5 minutes means the learner (or a re-render) submitted twice. Reuse it.
    if (args.testResultId) {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: dup } = await (supabase as any)
        .from("grading_jobs")
        .select("id,created_at")
        .eq("test_result_id", args.testResultId)
        .eq("part", args.partType)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (Array.isArray(dup) && dup.length > 0) {
        console.info("[enqueueGradingFallback] duplicate job suppressed", dup[0].id);
        return { id: dup[0].id as string };
      }
    }

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
      const msg = String((error as any)?.message || "enqueue_failed");
      // The DB-level unique index blocked a duplicate active job → reuse it.
      if (/duplicate key|grading_jobs_active_unique/i.test(msg) && args.testResultId) {
        const { data: existing } = await (supabase as any)
          .from("grading_jobs")
          .select("id")
          .eq("test_result_id", args.testResultId)
          .eq("part", args.partType)
          .in("status", ["pending", "processing"])
          .limit(1);
        if (Array.isArray(existing) && existing.length > 0) {
          return { id: existing[0].id as string };
        }
      }
      console.warn("[enqueueGradingFallback] enqueue rpc failed:", error);
      return { id: null, errorCode: msg };
    }


    // Best-effort: kick the worker immediately (cron is the guaranteed path).
    supabase.functions.invoke("process-grading-jobs", { body: {} }).catch(() => {});

    return { id: (data as string) ?? null };

  } catch (e) {
    console.warn("[enqueueGradingFallback] unexpected error:", e);
    return { id: null };
  }
}
