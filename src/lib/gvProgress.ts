import type { ExamProgressMap, ExamProgressItem } from "@/hooks/useUserExamProgress";

/**
 * A Grammar & Vocabulary "đề" is stored as 6 exam_sets (1 Core Grammar + 5 Vocab).
 * When the student runs the merged FULL 50-question practice, only ONE test_results
 * row is written (attached to the Core Grammar set) with total >= 50.
 *
 * This helper detects that full attempt and treats every part of the cluster as done,
 * so the card shows 6/6 instead of 1/6. Part-by-part attempts (total < 50) are counted
 * per set as before.
 */
const FULL_TOTAL_THRESHOLD = 50;

export function findGvFullAttempt(
  examSetIds: string[],
  progress: ExamProgressMap,
): ExamProgressItem | undefined {
  if (examSetIds.length < 2) return undefined;
  for (const id of examSetIds) {
    const p = progress.get(id);
    if (p && p.total >= FULL_TOTAL_THRESHOLD) return p;
  }
  return undefined;
}

/** Number of parts considered done for a G&V cluster. */
export function countGvDoneParts(examSetIds: string[], progress: ExamProgressMap): number {
  if (findGvFullAttempt(examSetIds, progress)) return examSetIds.length;
  return examSetIds.filter((id) => progress.has(id)).length;
}
