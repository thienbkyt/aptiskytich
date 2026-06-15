import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildReviewRequest,
  type ReadingReviewData,
  type TranslateReviewItem,
  type TranslateReviewPart3,
} from "@/lib/readingReview";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";

export type ReadingReviewStatus = "idle" | "loading" | "ready" | "error";

interface PartLike {
  partType: "part1" | "part2" | "part3" | "part4";
  part1Question?: ReadingSentenceQuestion;
  part2Question?: ReadingCohesionQuestion;
  part3Question?: ReadingOpinionQuestion;
  part4Question?: ReadingLongQuestion;
}

/**
 * Fetches translations + part3 evidence for a single exam_set (one Reading part).
 * Caches results in-memory per examSetId so re-mounting / switching parts does
 * not re-fetch within the same review session.
 */
const memoryCache = new Map<string, ReadingReviewData>();

export function useReadingReviewData(
  examSetId: string | null | undefined,
  part: PartLike | null,
  enabled: boolean,
) {
  const [data, setData] = useState<ReadingReviewData | null>(
    examSetId && memoryCache.has(examSetId) ? memoryCache.get(examSetId)! : null,
  );
  const [status, setStatus] = useState<ReadingReviewStatus>(
    examSetId && memoryCache.has(examSetId) ? "ready" : "idle",
  );
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!examSetId || !part) return;
    if (fetchedRef.current === examSetId) return;
    if (memoryCache.has(examSetId)) {
      setData(memoryCache.get(examSetId)!);
      setStatus("ready");
      fetchedRef.current = examSetId;
      return;
    }
    fetchedRef.current = examSetId;
    const { items, part3 } = buildReviewRequest(part);
    if (items.length === 0 && part3.length === 0) {
      setData({ translations: {}, part3Evidence: {} });
      setStatus("ready");
      return;
    }
    setStatus("loading");
    (async () => {
      try {
        const res = await supabase.functions.invoke("translate-review", {
          body: { exam_set_id: examSetId, items, part3 },
        });
        if (res.error) throw res.error;
        const payload = res.data as
          | { translations?: Record<string, string>; part3Evidence?: Record<string, { person: string; sentence: string }> }
          | null;
        const safe: ReadingReviewData = {
          translations: payload?.translations ?? {},
          part3Evidence: payload?.part3Evidence ?? {},
        };
        memoryCache.set(examSetId, safe);
        setData(safe);
        setStatus("ready");
      } catch (e) {
        console.warn("translate-review failed", e);
        setStatus("error");
      }
    })();
  }, [examSetId, enabled, part]);

  return { data, status };
}

// Exposed for tests / manual reset.
export function _clearReadingReviewCache() {
  memoryCache.clear();
}

export type { TranslateReviewItem, TranslateReviewPart3 };
