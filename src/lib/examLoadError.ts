/**
 * Helpers for the "exam room opened but the questions are hidden" failure mode.
 *
 * fetchExamQuestions throws an error tagged with code "EXAM_EMPTY" when a published
 * exam set returns zero questions — most often because the learner's Pro plan just
 * expired and RLS no longer exposes the rows. Call sites must block the exam instead
 * of letting the learner take a blank test and score 0.
 */
export function isExamEmptyError(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as any).code === "EXAM_EMPTY";
}

/** Pro/premium-only content that a "free" (expired) account can no longer read. */
export function isExpiredPlanBlock(
  e: unknown,
  tier: string | null | undefined,
  accessTier: string | null | undefined,
): boolean {
  return isExamEmptyError(e) && tier === "free" && !!accessTier && accessTier !== "free";
}

/** "· hết hạn 22/08/2026" style date for expiry copy. */
export function formatExpiry(proUntil: string | null | undefined): string | null {
  if (!proUntil) return null;
  const d = new Date(proUntil);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
