import { supabase } from "@/integrations/supabase/client";
import { getLevel } from "@/data/questions";

export interface PerQuestionResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

export interface SaveExamResultOpts {
  examSetId?: string | null;
  skill: string;
  correct: number;
  total: number;
  timeSpent?: number;
  perQuestion?: PerQuestionResult[];
  /** When set, this row is part of a Full Test session — always inserted (no best-score dedup) and tagged for grouping. */
  fullTestSessionId?: string | null;
  fullTestId?: string | null;
  /** Extra fields merged into the `skill_scores` JSON column (e.g. mode/label for Marathon rows). */
  extraSkillScores?: Record<string, any>;
  /** Frozen review payload — stored in `test_results.review_snapshot` for offline-style review. */
  reviewSnapshot?: any;
}

/**
 * In-flight guard against double-submit. Keyed by examSet+session so that
 * different parts of a Full Test can still save in parallel, but a single
 * part can't be inserted twice if the user spam-clicks "Nộp bài".
 */
const inFlight = new Set<string>();

/**
 * Save an exam result for the signed-in user. Best-effort: errors are swallowed
 * so the UI never breaks if the user is logged-out or RLS/network fails.
 *
 * - Saves an aggregate row to `test_results` only when the new score is
 *   strictly higher than the user's best previous score for the same exam_set_id.
 * - Saves per-question detail to `exam_question_results` (linked to the new
 *   test_results row) when an array is provided.
 * - Updates `learning_streaks` (creates row / increments / resets).
 */
export async function saveExamResult(opts: SaveExamResultOpts): Promise<string | null> {
  const lockKey = `${opts.examSetId || "noset"}::${opts.fullTestSessionId || "single"}::${opts.skill}`;
  if (inFlight.has(lockKey)) {
    console.warn("[saveExamResult] duplicate submit ignored:", lockKey);
    return null;
  }
  inFlight.add(lockKey);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;


    const total = Math.max(opts.total, 0);
    // Clamp correct to [0, total] to prevent score > total from buggy callers.
    const correctRaw = Math.max(opts.correct, 0);
    const correct = total > 0 ? Math.min(correctRaw, total) : correctRaw;
    if (correctRaw > total && total > 0) {
      console.warn("[saveExamResult] correct > total; clamped", { skill: opts.skill, correct: correctRaw, total });
    }
    const level = total > 0 ? getLevel(correct, total) : "A1";

    // Always insert a new test_results row per attempt (no best-score dedup).
    // History pages support multiple attempts and need a non-null test_result_id
    // for per-question detail lookup.
    let testResultId: string | null = null;
    {
      const { data: inserted, error } = await supabase
        .from("test_results")
        .insert({
          user_id: user.id,
          correct_answers: correct,
          score: correct,
          total: total || 1,
          level,
          exam_set_id: opts.examSetId ?? null,
          time_spent: opts.timeSpent ?? null,
          skill_scores: { skill: opts.skill, correct, total, ...(opts.extraSkillScores || {}) } as any,
          full_test_session_id: opts.fullTestSessionId ?? null,
          full_test_id: opts.fullTestId ?? null,
          review_snapshot: opts.reviewSnapshot ?? null,
        } as any)
        .select("id")
        .single();
      if (!error && inserted) testResultId = (inserted as any).id;
    }

    // Per-question detail
    if (opts.perQuestion && opts.perQuestion.length > 0) {
      const rows = opts.perQuestion
        .filter((r) => !!r.exam_question_id)
        .map((r) => ({
          user_id: user.id,
          test_result_id: testResultId,
          exam_question_id: r.exam_question_id,
          user_answer: r.user_answer,
          is_correct: r.is_correct,
          skill: opts.skill,
        }));
      if (rows.length > 0) {
        await supabase.from("exam_question_results").insert(rows as any);
      }
    }

    // Learning streak
    await updateLearningStreak(user.id);

    // Notify listeners (useUserExamProgress) so exam listings refresh without F5.
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("exam-result-saved", { detail: { skill: opts.skill, examSetId: opts.examSetId } }));
      }
    } catch { /* noop */ }

    return testResultId;
  } catch (err) {
    console.warn("[saveExamResult] skipped:", err);
    return null;
  } finally {
    inFlight.delete(lockKey);
  }
}

/**
 * Upsert a single History row for a Marathon session.
 *
 * First call for a session (no `testResultId`) INSERTs a `test_results` row and
 * returns its id. Subsequent calls UPDATE the same row's score/total/level/
 * correct_answers/review_snapshot via the `finalize_skill_test_result` RPC so
 * exit-during-marathon and full completion both land on the same History entry.
 *
 * `total === 0` is allowed for Writing marathons (no scoring); score/total are
 * stored as 0 and the label carries the "đã viết N/M" summary.
 */
export async function upsertMarathonResult(opts: {
  testResultId?: string | null;
  sessionId: string;
  skill: string;
  correct: number;
  total: number;
  /** Merged into `skill_scores` on insert. Should include `label` and `mode: "marathon"`. */
  extraSkillScores?: Record<string, any>;
  reviewSnapshot?: any;
}): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const total = Math.max(opts.total, 0);
    const correctRaw = Math.max(opts.correct, 0);
    const correct = total > 0 ? Math.min(correctRaw, total) : correctRaw;
    const level = total > 0 ? getLevel(correct, total) : "A1";

    const notify = () => {
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("exam-result-saved", { detail: { skill: opts.skill, marathon: true, sessionId: opts.sessionId } }));
        }
      } catch { /* noop */ }
    };

    // Update path — same row, new stats.
    if (opts.testResultId) {
      const { error } = await supabase.rpc("finalize_skill_test_result", {
        p_test_result_id: opts.testResultId,
        p_score: correct,
        p_total: total || 0,
        p_level: level,
        p_correct_answers: correct,
        p_review_snapshot: opts.reviewSnapshot ?? null,
      } as any);
      if (!error) {
        notify();
        return opts.testResultId;
      }
      // If the row was deleted underneath us, fall through to insert.
      console.warn("[upsertMarathonResult] update failed, re-inserting:", error);
    }

    const { data: inserted, error: insErr } = await supabase
      .from("test_results")
      .insert({
        user_id: user.id,
        correct_answers: correct,
        score: correct,
        // NOT NULL column — keep at least 1 so DB accepts writing (total=0) rows.
        total: Math.max(total, 1),
        level,
        exam_set_id: null,
        skill_scores: {
          skill: opts.skill,
          correct,
          total,
          mode: "marathon",
          marathonSessionId: opts.sessionId,
          ...(opts.extraSkillScores || {}),
        } as any,
        review_snapshot: opts.reviewSnapshot ?? null,
      } as any)
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.warn("[upsertMarathonResult] insert failed:", insErr);
      return null;
    }
    await updateLearningStreak(user.id);
    notify();
    return (inserted as any).id;
  } catch (err) {
    console.warn("[upsertMarathonResult] skipped:", err);
    return null;
  }
}




/** Today's date in Asia/Ho_Chi_Minh as YYYY-MM-DD. */
function getVNToday(): string {
  // sv-SE locale formats as YYYY-MM-DD; timeZone shifts the wall clock to VN.
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

async function updateLearningStreak(_userId: string) {
  try {
    const { error } = await (supabase as any).rpc("bump_learning_streak");
    if (error) console.warn("[updateLearningStreak] rpc failed:", error);
  } catch (err) {
    console.warn("[updateLearningStreak] skipped:", err);
  }
}


/**
 * Upload a single speaking recording for the signed-in user and persist a
 * row in `speaking_recordings`. Best-effort — errors are swallowed.
 */
export async function saveSpeakingRecording(opts: {
  examSetId?: string | null;
  part: string;
  blob: Blob;
  durationSeconds?: number;
  /** When set, link the recording row to this exact attempt so history review can scope by it. */
  testResultId?: string | null;
}): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const timestamp = Date.now();
    const setSegment = opts.examSetId || "no-set";
    const path = `${user.id}/${setSegment}/${opts.part}_${timestamp}.webm`;

    const { error: upErr } = await supabase.storage
      .from("speaking-recordings")
      .upload(path, opts.blob, {
        contentType: opts.blob.type || "audio/webm",
        upsert: false,
      });
    if (upErr) {
      console.warn("[saveSpeakingRecording] upload failed:", upErr);
      return null;
    }

    await supabase.from("speaking_recordings").insert({
      user_id: user.id,
      exam_set_id: opts.examSetId ?? null,
      part: opts.part,
      audio_url: path,
      duration_seconds: opts.durationSeconds ?? null,
      test_result_id: opts.testResultId ?? null,
    } as any);

    // Speaking sessions count as activity too
    await updateLearningStreak(user.id);
    return path;
  } catch (err) {
    console.warn("[saveSpeakingRecording] skipped:", err);
    return null;
  }
}


