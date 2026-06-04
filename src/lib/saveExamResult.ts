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
}

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
export async function saveExamResult(opts: SaveExamResultOpts): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const total = Math.max(opts.total, 0);
    const correct = Math.max(opts.correct, 0);
    const level = total > 0 ? getLevel(correct, total) : "A1";

    // Best score check (per user + exam_set_id)
    let shouldInsert = true;
    let testResultId: string | null = null;
    if (opts.examSetId) {
      const { data: prev } = await supabase
        .from("test_results")
        .select("score")
        .eq("user_id", user.id)
        .eq("exam_set_id", opts.examSetId)
        .order("score", { ascending: false })
        .limit(1);
      const bestPrev = prev?.[0]?.score ?? -1;
      if (correct <= bestPrev) shouldInsert = false;
    }

    if (shouldInsert) {
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
          skill_scores: { skill: opts.skill, correct, total } as any,
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
  } catch (err) {
    console.warn("[saveExamResult] skipped:", err);
  }
}

async function updateLearningStreak(userId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing, error: selErr } = await supabase
      .from("learning_streaks")
      .select("id,current_streak,longest_streak,last_activity_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) {
      console.warn("[updateLearningStreak] select failed:", selErr);
    }

    if (!existing) {
      const { error: insErr } = await supabase.from("learning_streaks").insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      } as any);
      if (insErr) console.warn("[updateLearningStreak] insert failed:", insErr);
      return;
    }

    // Same day → nothing to update
    if (existing.last_activity_date === today) return;

    // Compute yesterday (UTC date math is fine for day diff)
    const todayD = new Date(today + "T00:00:00Z").getTime();
    const lastD = existing.last_activity_date
      ? new Date(existing.last_activity_date + "T00:00:00Z").getTime()
      : 0;
    const diffDays = lastD ? Math.round((todayD - lastD) / 86400000) : Infinity;

    const newCurrent = diffDays === 1 ? (existing.current_streak || 0) + 1 : 1;
    const newLongest = Math.max(existing.longest_streak || 0, newCurrent);

    const { error: updErr } = await supabase
      .from("learning_streaks")
      .update({
        current_streak: newCurrent,
        longest_streak: newLongest,
        last_activity_date: today,
      } as any)
      .eq("id", existing.id);
    if (updErr) console.warn("[updateLearningStreak] update failed:", updErr);
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
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      return;
    }

    await supabase.from("speaking_recordings").insert({
      user_id: user.id,
      exam_set_id: opts.examSetId ?? null,
      part: opts.part,
      audio_url: path,
      duration_seconds: opts.durationSeconds ?? null,
    } as any);

    // Speaking sessions count as activity too
    await updateLearningStreak(user.id);
  } catch (err) {
    console.warn("[saveSpeakingRecording] skipped:", err);
  }
}

