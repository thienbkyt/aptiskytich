import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enqueueGradingFallback } from "@/lib/gradingQueue";

/**
 * DISPLAY-ONLY status of an AI Writing attempt.
 *
 * Part 4 (and any part that fell back to the async queue) can finish grading
 * minutes AFTER the student sees the results screen. Showing "0/50" in that
 * window reads as "the site ate my submission", so every Writing results
 * surface needs to tell the three states apart:
 *   graded  → writing_question_gradings row (or writing_skill_results.parts[task])
 *   pending → a grading_jobs row still pending/processing (or nothing yet)
 *   failed  → grading_jobs row failed with attempts >= max_attempts
 *
 * This hook NEVER computes or writes scores — it only reads what the grading
 * pipeline already persisted, and polls while something is still in flight.
 */

export type WritingPartStatus = "graded" | "pending" | "failed" | "recoverable";

const POLL_MS = 15_000;
const MAX_POLLS = 20; // ~5 minutes

export interface WritingGradingStatusResult {
  loading: boolean;
  /** task1..task4 → status */
  statusByPart: Record<string, WritingPartStatus>;
  pendingParts: string[];
  failedParts: string[];
  recoverableParts: string[];
  /** Per-part raw score (0-30) when graded. */
  partScores: Record<string, number>;
  /** Official skill score from writing_skill_results, when finalized. */
  scale50: number | null;
  cefr: string | null;
  isPolling: boolean;
  /** True while at least one part is still being graded. */
  isGrading: boolean;
  refresh: () => void;
  retryPart: (part: string) => Promise<boolean>;
  recoverPart: (part: string) => Promise<{ ok: boolean; upgrade?: boolean }>;
}

interface Options {
  /** full_test_session_id / fullPartSession id of the attempt. */
  sessionId?: string | null;
  /** test_results ids of the writing parts, when known. */
  testResultIds?: (string | null | undefined)[];
  /** Parts expected in this attempt, e.g. ["task1","task2","task3","task4"]. */
  expectedParts: string[];
  /**
   * Parts already graded in-session by the client (score in memory but not yet
   * mirrored to writing_question_gradings). Never shown as "đang chấm".
   */
  locallyGradedParts?: string[];
  enabled?: boolean;

}

const normPart = (p: string | null | undefined): string => {
  const m = String(p ?? "").match(/(\d)/);
  return m ? `task${m[1]}` : "";
};

export function useWritingGradingStatus({
  sessionId,
  testResultIds,
  expectedParts,
  locallyGradedParts,
  enabled = true,
}: Options): WritingGradingStatusResult {

  const [loading, setLoading] = useState(enabled);
  const [statusByPart, setStatusByPart] = useState<Record<string, WritingPartStatus>>({});
  const [partScores, setPartScores] = useState<Record<string, number>>({});
  const [scale50, setScale50] = useState<number | null>(null);
  const [cefr, setCefr] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [tick, setTick] = useState(0);

  const failedJobsRef = useRef<Record<string, any>>({});
  const resultIdByPartRef = useRef<Record<string, string>>({});
  const pollCountRef = useRef(0);
  const idsKey = (testResultIds || []).filter(Boolean).join(",");
  const partsKey = expectedParts.join(",");
  const localKey = (locallyGradedParts || []).join(",");


  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled || expectedParts.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        let ids = (testResultIds || []).filter(Boolean) as string[];
        if (ids.length === 0 && sessionId) {
          const { data } = await supabase
            .from("test_results")
            .select("id")
            .eq("full_test_session_id", sessionId);
          ids = ((data || []) as any[]).map((r) => r.id);
        }

        const gradingsP = ids.length
          ? supabase
              .from("writing_question_gradings")
              .select("part,part_score,test_result_id")
              .in("test_result_id", ids)
          : Promise.resolve({ data: [] as any[] } as any);

        let wsrQ = supabase
          .from("writing_skill_results")
          .select("parts,scale50,cefr,created_at")
          .order("created_at", { ascending: false })
          .limit(1);
        if (sessionId) wsrQ = wsrQ.eq("full_test_session_id", sessionId);
        else if (ids.length) wsrQ = wsrQ.in("test_result_id", ids);

        const jobsP = ids.length
          ? (supabase as any)
              .from("grading_jobs")
              .select("id,part,status,attempts,max_attempts,payload,test_result_id")
              .eq("skill", "writing")
              .in("test_result_id", ids)
          : Promise.resolve({ data: [] as any[] } as any);

        const answersP = ids.length
          ? supabase.from("exam_question_results").select("test_result_id,user_answer").in("test_result_id", ids)
          : Promise.resolve({ data: [] as any[] } as any);

        const resultPartsP = ids.length
          ? supabase.from("test_results").select("id,exam_sets(part)").in("id", ids)
          : Promise.resolve({ data: [] as any[] } as any);

        const [gRes, wRes, jRes, aRes, rRes] = await Promise.all([gradingsP, wsrQ, jobsP, answersP, resultPartsP]);
        if (cancelled) return;

        const scores: Record<string, number> = {};
        ((gRes as any).data || []).forEach((r: any) => {
          const k = normPart(r.part);
          if (k && typeof r.part_score === "number") scores[k] = r.part_score;
        });

        const wsr = ((wRes as any).data || [])[0] || null;
        const wsrParts = (wsr?.parts || {}) as Record<string, any>;
        Object.entries(wsrParts).forEach(([k, v]: [string, any]) => {
          const key = normPart(k);
          const raw = Number(v?.rawPart);
          if (key && Number.isFinite(raw) && scores[key] === undefined) scores[key] = raw;
        });

        const jobsByPart: Record<string, any[]> = {};
        ((jRes as any).data || []).forEach((j: any) => {
          const k = normPart(j.part);
          if (k) (jobsByPart[k] ||= []).push(j);
        });
        const submittedIds = new Set(
          (((aRes as any).data || []) as any[])
            .filter((row) => String(row.user_answer ?? "").trim().length > 0)
            .map((row) => row.test_result_id),
        );
        const resultIdByPart: Record<string, string> = {};
        (((rRes as any).data || []) as any[]).forEach((row) => {
          const key = normPart(row.exam_sets?.part);
          if (key) resultIdByPart[key] = row.id;
        });

        const localSet = new Set((locallyGradedParts || []).map((p) => normPart(p) || p));
        const failedJobs: Record<string, any> = {};
        const map: Record<string, WritingPartStatus> = {};
        expectedParts.forEach((p) => {
          const k = normPart(p) || p;
          if (scores[k] !== undefined || localSet.has(k)) {
            map[k] = "graded";
            return;
          }

          const jobs = jobsByPart[k] || [];
          const active = jobs.some((j) => j.status === "pending" || j.status === "processing");
          if (active) {
            map[k] = "pending";
            return;
          }
          const resultId = resultIdByPart[k];
          if (resultId && submittedIds.has(resultId)) {
            map[k] = "recoverable";
            return;
          }
          const dead = jobs.find(
            (j) => j.status === "failed" && Number(j.attempts) >= Number(j.max_attempts),
          );
          if (dead) {
            map[k] = "failed";
            failedJobs[k] = dead;
            return;
          }
          map[k] = "pending";
        });

        failedJobsRef.current = failedJobs;
        resultIdByPartRef.current = resultIdByPart;
        setPartScores(scores);
        setStatusByPart(map);
        setScale50(typeof wsr?.scale50 === "number" ? wsr.scale50 : null);
        setCefr(typeof wsr?.cefr === "string" && wsr.cefr ? wsr.cefr : null);
      } catch (e) {
        console.warn("[useWritingGradingStatus] read failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, sessionId, idsKey, partsKey, localKey, tick]);

  const pendingParts = Object.entries(statusByPart)
    .filter(([, s]) => s === "pending")
    .map(([k]) => k)
    .sort();
  const failedParts = Object.entries(statusByPart)
    .filter(([, s]) => s === "failed")
    .map(([k]) => k)
    .sort();
  const recoverableParts = Object.entries(statusByPart)
    .filter(([, s]) => s === "recoverable")
    .map(([k]) => k)
    .sort();

  // Poll only while something is genuinely still being graded, and never forever.
  const hasPending = pendingParts.length > 0;
  useEffect(() => {
    if (!enabled || loading || !hasPending) {
      setIsPolling(false);
      return;
    }
    if (pollCountRef.current >= MAX_POLLS) {
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    const t = window.setTimeout(() => {
      pollCountRef.current += 1;
      refresh();
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [enabled, loading, hasPending, tick, refresh]);

  const retryPart = useCallback(
    async (part: string): Promise<boolean> => {
      const k = normPart(part) || part;
      const job = failedJobsRef.current[k];
      if (!job?.payload) return false;
      const meta = job.payload?._meta || {};
      const { id } = await enqueueGradingFallback({
        skill: "writing",
        partType: job.part || k,
        testResultId: job.test_result_id ?? null,
        examSetId: meta.examSetId ?? null,
        fullTestSessionId: meta.fullTestSessionId ?? sessionId ?? null,
        payload: job.payload,
        lastError: "manual retry from results screen",
      });
      if (!id) return false;
      setStatusByPart((prev) => ({ ...prev, [k]: "pending" }));
      pollCountRef.current = 0;
      refresh();
      return true;
    },
    [sessionId, refresh],
  );

  const recoverPart = useCallback(async (part: string): Promise<{ ok: boolean; upgrade?: boolean }> => {
    const k = normPart(part) || part;
    const testResultId = resultIdByPartRef.current[k];
    if (!testResultId) return { ok: false };
    const { data, error } = await supabase.functions.invoke("rebuild-writing-grade", {
      body: { test_result_id: testResultId },
    });
    if (error || !data || data.error) return { ok: false, upgrade: Boolean(data?.upgrade) };
    setStatusByPart((prev) => ({ ...prev, [k]: "pending" }));
    pollCountRef.current = 0;
    refresh();
    return { ok: true };
  }, [refresh]);

  return {
    loading,
    statusByPart,
    pendingParts,
    failedParts,
    recoverableParts,
    partScores,
    scale50,
    cefr,
    isPolling,
    isGrading: hasPending,
    refresh,
    retryPart,
    recoverPart,
  };
}

export default useWritingGradingStatus;
