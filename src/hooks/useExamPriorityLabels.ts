import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PriorityLabel = "high" | "medium" | "low";

export interface ExamPriorityInfo {
  label: PriorityLabel;
}

export interface ExamPriorityData {
  labels: Map<string, ExamPriorityInfo>;
  keyId: string | null;
  keyDate: string | null;
  loading: boolean;
}

/** prediction_items.priority → UI priority label */
const PRIORITY_FROM_DB: Record<string, PriorityLabel> = {
  high: "high",
  medium: "medium",
  low: "low",
  backup: "low",
};

/**
 * Priority labels come straight from the currently effective prediction key
 * (published key for today, otherwise the latest published key).
 * Exams that are not in that key get no label at all.
 */
export function useExamPriorityLabels(): ExamPriorityData {
  const { data, isLoading } = useQuery({
    queryKey: ["examPriorityLabels", "currentKey"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("get_current_key_labels");
      if (error) throw error;
      if (!rows?.length) return { labels: new Map<string, ExamPriorityInfo>(), keyId: null, keyDate: null };

      const labels = new Map<string, ExamPriorityInfo>();
      (rows as any[]).forEach((it: any) => {
        const label = PRIORITY_FROM_DB[String(it?.priority ?? "").toLowerCase()];
        if (!it?.exam_set_id || !label) return;
        const existing = labels.get(it.exam_set_id)?.label;
        // keep the strongest priority if an exam appears more than once
        if (!existing || PRIORITY_ORDER.indexOf(label) < PRIORITY_ORDER.indexOf(existing)) {
          labels.set(it.exam_set_id, { label });
        }
      });
      return { labels, keyId: rows[0].key_id as string, keyDate: rows[0].key_date as string };
    },
  });

  return {
    labels: data?.labels ?? new Map<string, ExamPriorityInfo>(),
    keyId: data?.keyId ?? null,
    keyDate: data?.keyDate ?? null,
    loading: isLoading,
  };
}

/** Aggregate priority for a group of exam_set_ids (used by Grammar full sets): strongest wins. */
export function aggregatePriority(
  examSetIds: string[],
  labels: Map<string, ExamPriorityInfo>,
): ExamPriorityInfo | null {
  let best: PriorityLabel | null = null;
  examSetIds.forEach((id) => {
    const l = labels.get(id)?.label;
    if (!l) return;
    if (!best || PRIORITY_ORDER.indexOf(l) < PRIORITY_ORDER.indexOf(best)) best = l;
  });
  return best ? { label: best } : null;
}

/** Aggregate group priority by majority rule (used by Full Part / Full Test cards):
 *  - >= 50% of parts are high => high
 *  - else >= 50% of parts are high+medium => medium
 *  - otherwise no badge.
 */
export function aggregateGroupPriority(
  examSetIds: string[],
  labels: Map<string, ExamPriorityInfo>,
): PriorityLabel | null {
  const n = examSetIds.length;
  if (n === 0) return null;
  let high = 0;
  let medium = 0;
  examSetIds.forEach((id) => {
    const l = labels.get(id)?.label;
    if (l === "high") high++;
    else if (l === "medium") medium++;
  });
  if (high >= n / 2) return "high";
  if (high + medium >= n / 2) return "medium";
  return null;
}


export const PRIORITY_LABEL_VI: Record<PriorityLabel, string> = {
  high: "Ưu tiên cao",
  medium: "Ưu tiên vừa",
  low: "Ưu tiên thấp",
};

export const PRIORITY_ORDER: PriorityLabel[] = ["high", "medium", "low"];
