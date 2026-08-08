// Shared writing-session finalize logic.
//
// A writing session is "settled" when writing_skill_results exists for
// (user_id, full_test_session_id). Per-part raw scores (/30) can come from two
// different graders:
//   • the worker (process-grading-jobs) → writing_question_gradings row
//   • the client (grade-exam called directly) → NO gradings row, the rawPart is
//     stored as `score` on the writing test_results row for that part
// Mixed attempts (some parts client-graded, some worker-graded) must still be
// finalized, so we merge both sources before computing scale50/CEFR.
//
// scale50/CEFR always go through the existing `writing_finalize` path in
// grade-exam (which applies coreGV + grey-zone rules). No local formulas.

export const WRITING_PART_KEYS = ["task1", "task2", "task3", "task4"] as const;

type InvokeGradeExam = (
  payload: any,
  userId: string,
) => Promise<{ ok: boolean; status: number; body: any }>;

export type WritingRow = {
  id: string;
  score: number | null;
  level: string | null;
  exam_set_id: string | null;
  review_snapshot: any;
  created_at?: string;
};

/**
 * Map the session's writing test_results rows onto canonical part keys.
 * Prefers the part recorded in the review snapshot, falls back to
 * chronological order for legacy rows without one.
 */
export function mapWritingRowsToParts(rows: WritingRow[]): Record<string, WritingRow> {
  const byPart: Record<string, WritingRow> = {};
  const leftovers: WritingRow[] = [];

  for (const r of rows) {
    const snap = r?.review_snapshot || {};
    const part = String(snap?.part ?? snap?.raw?.partType ?? "").trim();
    if ((WRITING_PART_KEYS as readonly string[]).includes(part) && !byPart[part]) {
      byPart[part] = r;
    } else {
      leftovers.push(r);
    }
  }

  for (const r of leftovers) {
    const free = WRITING_PART_KEYS.find((k) => !byPart[k]);
    if (!free) break;
    byPart[free] = r;
  }

  return byPart;
}

/**
 * Resolve rawPart (/30) per part, preferring writing_question_gradings and
 * falling back to the score already stored on the part's test_results row.
 * Returns null when any of the 4 parts still has no score from either source.
 */
export function resolveWritingRawParts(
  gradings: Array<{ part: string; part_score: number | null; item_index?: number }>,
  rowsByPart: Record<string, WritingRow>,
): Record<string, number> | null {
  const rawParts: Record<string, number> = {};

  for (const g of gradings || []) {
    if (!(WRITING_PART_KEYS as readonly string[]).includes(g.part)) continue;
    if (g.item_index != null && g.item_index !== 0) continue;
    const v = Number(g.part_score);
    if (Number.isFinite(v)) rawParts[g.part] = v;
  }

  for (const k of WRITING_PART_KEYS) {
    if (Number.isFinite(rawParts[k])) continue;
    const row = rowsByPart[k];
    const v = Number(row?.score);
    if (row && Number.isFinite(v)) rawParts[k] = v;
  }

  if (!WRITING_PART_KEYS.every((k) => Number.isFinite(rawParts[k]))) return null;
  return rawParts;
}

/**
 * Compute scale50/CEFR via grade-exam's writing_finalize and upsert
 * writing_skill_results, then patch the last part's test_results row
 * (same pattern the worker already uses).
 */
export async function finalizeWritingSession(opts: {
  admin: any;
  invokeGradeExam: InvokeGradeExam;
  userId: string;
  sessionId: string;
  rawParts: Record<string, number>;
  coreGV: string | null;
  forcedComplexity: boolean;
  examSetId: string | null;
  lastTestResultId: string;
}): Promise<{ scale50: number; cefr: string } | null> {
  const { body, ok } = await opts.invokeGradeExam({
    type: "writing_finalize",
    rawParts: opts.rawParts,
    coreGV: opts.coreGV,
    forcedComplexity: opts.forcedComplexity,
  }, opts.userId);
  if (!ok || !body) return null;

  const scale50 = Number(body.scale50 ?? 0);
  const cefr = String(body.cefr ?? "A0");
  const rawTotal = Number(body.rawTotal ?? body.raw_total ?? 0);
  const greyZone = !!body.greyZone;
  const flagReview = !!body.flagReview;

  const partsPayload: Record<string, any> = {};
  for (const k of WRITING_PART_KEYS) partsPayload[k] = { rawPart: opts.rawParts[k] };

  const { error: srErr } = await opts.admin.from("writing_skill_results").upsert({
    user_id: opts.userId,
    test_result_id: opts.lastTestResultId,
    exam_set_id: opts.examSetId,
    full_test_session_id: opts.sessionId,
    parts: partsPayload,
    raw_total: rawTotal,
    scale50,
    cefr,
    grey_zone: greyZone,
    flag_review: flagReview,
  }, { onConflict: "user_id,full_test_session_id" });
  if (srErr) throw new Error(`writing_skill_results upsert failed: ${srErr.message}`);

  await opts.admin.from("test_results").update({
    score: scale50,
    total: 50,
    correct_answers: scale50,
    level: cefr,
  }).eq("id", opts.lastTestResultId);

  return { scale50, cefr };
}
