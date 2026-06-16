import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildHighlightRequest,
  type ListeningHighlightData,
  type ListeningHighlightPart,
} from "@/lib/listeningReview";

export type ListeningHighlightStatus = "idle" | "loading" | "ready" | "error";

const memoryCache = new Map<string, ListeningHighlightData>();

export function useListeningHighlightData(
  examSetId: string | null | undefined,
  part: ListeningHighlightPart | null,
  enabled: boolean,
) {
  const [data, setData] = useState<ListeningHighlightData | null>(
    examSetId && memoryCache.has(examSetId) ? memoryCache.get(examSetId)! : null,
  );
  const [status, setStatus] = useState<ListeningHighlightStatus>(
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
    const items = buildHighlightRequest(part);
    if (items.length === 0) {
      const empty: ListeningHighlightData = { highlights: {} };
      memoryCache.set(examSetId, empty);
      setData(empty);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    (async () => {
      try {
        const res = await supabase.functions.invoke("listening-highlight", {
          body: { exam_set_id: examSetId, items },
        });
        if (res.error) throw res.error;
        const payload = res.data as { highlights?: Record<string, string> } | null;
        const safe: ListeningHighlightData = { highlights: payload?.highlights ?? {} };
        memoryCache.set(examSetId, safe);
        setData(safe);
        setStatus("ready");
      } catch (e) {
        console.warn("listening-highlight failed", e);
        setStatus("error");
      }
    })();
  }, [examSetId, enabled, part]);

  return { data, status };
}

export function _clearListeningHighlightCache() {
  memoryCache.clear();
}
