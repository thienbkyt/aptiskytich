import { supabase } from "@/integrations/supabase/client";
import { toScaledScore, getSkillBand } from "@/data/questions";

/**
 * Grammar & Vocabulary ("core GV") band helper.
 *
 * The grey-zone bump in `grade-exam` (writing_finalize / speaking_finalize)
 * only fires when a `coreGV` CEFR band is supplied. Aptis has no dedicated
 * G&V band scale, so we map the G&V percentage onto the reading thresholds.
 */
export function gvBandFromScore(correct: number, total: number): string | null {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return null;
  return getSkillBand(toScaledScore(correct, total), "reading");
}

/**
 * Resolve the user's most relevant Grammar & Vocabulary band:
 * 1. the G&V attempt inside the same session (Full Test), when present;
 * 2. otherwise the user's latest G&V attempt.
 *
 * Best-effort: always resolves, returns `null` instead of throwing.
 */
export async function fetchCoreGVBand(opts?: {
  fullTestSessionId?: string | null;
  /** In-memory score from the current session, used before falling back to DB. */
  inSession?: { correct: number; total: number } | null;
}): Promise<string | null> {
  try {
    const inSession = opts?.inSession;
    if (inSession && inSession.total > 0) {
      return gvBandFromScore(inSession.correct, inSession.total);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const base = () =>
      supabase
        .from("test_results")
        .select("score,total,skill_scores,created_at")
        .eq("user_id", user.id)
        .eq("skill_scores->>skill", "grammar_vocab")
        .order("created_at", { ascending: false })
        .limit(1);

    if (opts?.fullTestSessionId) {
      const { data } = await base().eq("full_test_session_id", opts.fullTestSessionId);
      const row: any = data?.[0];
      if (row) {
        const band = gvBandFromScore(Number(row.score ?? 0), Number(row.total ?? 0));
        if (band) return band;
      }
    }

    // Fallback: the user's BEST G&V attempt (ignoring abandoned 0-score rows),
    // so one walk-away attempt can't strip the grey-zone bump.
    const { data: history } = await supabase
      .from("test_results")
      .select("score,total,skill_scores,created_at")
      .eq("user_id", user.id)
      .eq("skill_scores->>skill", "grammar_vocab")
      .gt("score", 0)
      .order("created_at", { ascending: false })
      .limit(200);

    let bestRatio = 0;
    let bestRow: any = null;
    for (const row of (history as any[]) || []) {
      const score = Number(row.score ?? 0);
      const total = Number(row.total ?? 0);
      if (!(score > 0) || !(total > 0)) continue;
      const ratio = score / total;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestRow = row;
      }
    }
    if (!bestRow) return null;
    return gvBandFromScore(Number(bestRow.score ?? 0), Number(bestRow.total ?? 0));
  } catch (e) {
    console.warn("[fetchCoreGVBand] skipped:", e);
    return null;
  }
}
