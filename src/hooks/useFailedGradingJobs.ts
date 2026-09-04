import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Failed AI grading jobs of the signed-in learner, keyed by test_result_id.
 *
 * The background worker marks a job 'failed' once every attempt is spent, so an
 * attempt can never sit in the queue forever any more. The history screen uses
 * this to replace the empty "—" score with a "Chấm lại" button.
 *
 * Retry is capped at 2 per attempt — the cap and the ownership check live in
 * the retry_failed_grading_job database function, this hook only mirrors it so
 * the button can be hidden once the cap is reached.
 */

export const MAX_MANUAL_RETRIES = 2;

export interface FailedGradingJob {
  id: string;
  skill: string;
  part: string | null;
  testResultId: string;
  retries: number;
  canRetry: boolean;
}

export function useFailedGradingJobs(enabled: boolean) {
  const [jobsByResult, setJobsByResult] = useState<Record<string, FailedGradingJob>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("grading_jobs")
        .select("id,skill,part,test_result_id,payload,created_at")
        .eq("status", "failed")
        .not("test_result_id", "is", null)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn("[useFailedGradingJobs] read failed", error);
        return;
      }
      const map: Record<string, FailedGradingJob> = {};
      ((data || []) as any[]).forEach((j) => {
        const retries = Number(j?.payload?._manualRetries ?? 0) || 0;
        // Latest failed job per attempt wins (rows are ordered oldest first).
        map[j.test_result_id] = {
          id: j.id,
          skill: String(j.skill ?? ""),
          part: j.part ?? null,
          testResultId: j.test_result_id,
          retries,
          canRetry: retries < MAX_MANUAL_RETRIES,
        };
      });
      setJobsByResult(map);
    })();
    return () => { cancelled = true; };
  }, [enabled, tick]);

  const retry = useCallback(async (jobId: string): Promise<{ ok: boolean; reason?: string }> => {
    setRetryingId(jobId);
    try {
      const { error } = await (supabase as any).rpc("retry_failed_grading_job", { p_job_id: jobId });
      if (error) {
        return { ok: false, reason: String((error as any)?.message || "retry_failed") };
      }
      // Kick the worker straight away; cron is the guaranteed path.
      supabase.functions.invoke("process-grading-jobs", { body: {} }).catch(() => {});
      setJobsByResult((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { if (next[k].id === jobId) delete next[k]; });
        return next;
      });
      return { ok: true };
    } finally {
      setRetryingId(null);
    }
  }, []);

  return { jobsByResult, retry, retryingId, refresh };
}

export default useFailedGradingJobs;
