import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PriorityLabel = "high" | "medium" | "low";

export interface ExamPriorityInfo {
  count: number;
  ratio: number;
  label: PriorityLabel;
}

export interface ExamPriorityData {
  labels: Map<string, ExamPriorityInfo>;
  keySetsBySet: Map<string, Set<string>>;
  windowSize: number;
  loading: boolean;
}

const WINDOW = 30;

/**
 * Computes automatic "priority" labels for exam sets based on how often each
 * exam appears in the most recent WINDOW (30) published prediction keys.
 *   ratio > 50%   → "high"
 *   35% – 50%     → "medium"
 *   < 35% (>0)    → "low"
 *   0             → no label
 */
export function useExamPriorityLabels(): ExamPriorityData {
  const { data, isLoading } = useQuery({
    queryKey: ["examPriorityLabels", WINDOW],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: keys } = await supabase
        .from("prediction_keys")
        .select("id, date")
        .eq("is_published", true)
        .order("date", { ascending: false })
        .limit(WINDOW);
      const keyIds = (keys ?? []).map((k: any) => k.id as string);
      if (keyIds.length === 0) {
        return { keySetsBySet: new Map<string, Set<string>>(), windowSize: 0 };
      }
      const { data: items } = await supabase
        .from("prediction_items")
        .select("exam_set_id, key_id")
        .in("key_id", keyIds);
      const keySetsBySet = new Map<string, Set<string>>();
      (items ?? []).forEach((row: any) => {
        if (!row?.exam_set_id || !row?.key_id) return;
        let s = keySetsBySet.get(row.exam_set_id);
        if (!s) { s = new Set(); keySetsBySet.set(row.exam_set_id, s); }
        s.add(row.key_id);
      });
      return { keySetsBySet, windowSize: keyIds.length };
    },
  });

  const keySetsBySet = data?.keySetsBySet ?? new Map<string, Set<string>>();
  const windowSize = data?.windowSize ?? 0;

  const labels = new Map<string, ExamPriorityInfo>();
  if (windowSize > 0) {
    keySetsBySet.forEach((keys, setId) => {
      const count = keys.size;
      if (count === 0) return;
      const ratio = count / windowSize;
      const label: PriorityLabel = ratio > 0.5 ? "high" : ratio >= 0.35 ? "medium" : "low";
      labels.set(setId, { count, ratio, label });
    });
  }

  return { labels, keySetsBySet, windowSize, loading: isLoading };
}

/** Compute an aggregate priority label for a group of exam_set_ids (used by Grammar full sets). */
export function aggregatePriority(
  examSetIds: string[],
  keySetsBySet: Map<string, Set<string>>,
  windowSize: number,
): ExamPriorityInfo | null {
  if (windowSize <= 0 || examSetIds.length === 0) return null;
  const combined = new Set<string>();
  examSetIds.forEach((id) => {
    const ks = keySetsBySet.get(id);
    if (ks) ks.forEach((k) => combined.add(k));
  });
  if (combined.size === 0) return null;
  const ratio = combined.size / windowSize;
  const label: PriorityLabel = ratio > 0.5 ? "high" : ratio >= 0.35 ? "medium" : "low";
  return { count: combined.size, ratio, label };
}

export const PRIORITY_LABEL_VI: Record<PriorityLabel, string> = {
  high: "Ưu tiên cao",
  medium: "Ưu tiên vừa",
  low: "Ưu tiên thấp",
};

export const PRIORITY_ORDER: PriorityLabel[] = ["high", "medium", "low"];
