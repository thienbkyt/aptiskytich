/**
 * Frozen "snapshot" of everything a History/Review screen needs to render
 * one attempt — without re-fetching the live exam data, gradings, or
 * translation/highlight edge functions. Saved into `test_results.review_snapshot`.
 *
 * Snapshots are opaque JSON, but follow this shape (v1) so future readers
 * can stay backwards-compatible.
 */

export interface ReviewSnapshotItem {
  /** Question prompt as shown to the user. */
  questionText?: string;
  /** Multiple-choice options, in display order. */
  options?: string[];
  /** Correct answer (index for MCQ, free-form string otherwise). */
  correctAnswer?: number | string | null;
  /** Optional explanation for the correct answer. */
  explanation?: string | null;
  /** What the user actually answered (raw). */
  userAnswer?: number | string | null;
  isCorrect?: boolean;
  /** Listening: segment of the script (HTML or text) highlighting the answer. */
  highlight?: string | null;
  /** Reading: Vietnamese translation of the question/sentence. */
  translation?: string | null;
  /** Speaking/Writing: per-item AI grading payload. */
  ai?: ReviewSnapshotAI | null;
  /** Engine-specific extras (e.g. nested sub-answers). */
  extra?: Record<string, any>;
}

export interface ReviewSnapshotAI {
  partScore?: number;
  maxPoints?: number;
  grammarErrors?: any[];
  spellingErrors?: any[];
  pronunciationErrors?: any[];
  feedback?: string | null;
  transcript?: string | null;
  improvedVersion?: string | null;
  /** Storage path inside `speaking-recordings` bucket. */
  recordingPath?: string | null;
}

export interface ReviewSnapshot {
  version: 1;
  skill: string;
  part?: string | null;
  testTitle?: string | null;
  /** Raw score (correct count for MCQ; AI total for AI-graded). */
  score?: number;
  total?: number;
  /** Display-friendly score scaled to /50 (Aptis convention). */
  scaled50?: number | null;
  band?: string | null;
  items: ReviewSnapshotItem[];
  /** Escape hatch — engine-shaped data used when item flattening isn't clean
   *  (e.g. Reading part2/3, Listening part2/4). The review page can use this
   *  to re-render via the existing engine in `reviewMode`. */
  raw?: Record<string, any> | null;
  /** ISO timestamp for diagnostics. */
  capturedAt?: string;
}

export function buildReviewSnapshot(
  partial: Omit<ReviewSnapshot, "version" | "capturedAt" | "items"> & {
    items?: ReviewSnapshotItem[];
  },
): ReviewSnapshot {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    items: partial.items ?? [],
    ...partial,
  };
}
