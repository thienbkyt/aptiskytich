import { getSkillBand } from "@/data/questions";

export const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  grammar_vocab: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export interface HistoryDisplay {
  displayScore: string;
  displayBand: string;
  scorePct: number | null;
}

export const computeHistoryDisplay = (
  r: { skill: string; score: number; total: number; level: string },
  snapshot: any,
  writingAgg?: { sum: number; max: number } | null,
  speakingAgg?: { sum: number; max: number } | null,
): HistoryDisplay => {
  const skill = r.skill;

  const isAI = skill === "speaking" || skill === "writing";

  const noBand = skill === "grammar" || skill === "grammar_vocab";

  const snapScaled = snapshot && typeof snapshot.scaled50 === "number" ? snapshot.scaled50 : null;

  const snapBand = snapshot && typeof snapshot.band === "string" && snapshot.band ? snapshot.band : null;

  if (isAI) {

    if (skill === "writing" && r.total === 30) {

      if (writingAgg && writingAgg.max > 0) {
        return {
          displayScore: `${Number(writingAgg.sum.toFixed(1))}/${writingAgg.max}`,
          displayBand: "—",
          scorePct: writingAgg.sum / writingAgg.max,
        };
      }

      return {
        displayScore: `${r.score}/${r.total}`,
        displayBand: "—",
        scorePct: r.score / r.total,
      };

    }

    const agg = skill === "writing" ? writingAgg : speakingAgg;


    if (agg && agg.max > 0) {

      const scaled = Math.round((agg.sum / agg.max) * 50);

      return {

        displayScore: `${Number(agg.sum.toFixed(1))}/${agg.max}`,

        displayBand: getSkillBand(scaled, skill as any),

        scorePct: agg.sum / agg.max,

      };

    }

    if (snapScaled != null && snapScaled > 0) {

      return {

        displayScore: `${snapScaled}/50`,

        // Saved band wins (grey-zone aware); thresholds are fallback only.
        displayBand: snapBand || getSkillBand(snapScaled, skill as any),

        scorePct: snapScaled / 50,

      };

    }


    return { displayScore: "—", displayBand: "—", scorePct: null };

  }

  if (skill === "reading" || skill === "listening") {
    if (r.total > 0) {
      return {
        displayScore: `${r.score}/${r.total}`,
        displayBand: "—",
        scorePct: r.score / r.total,
      };
    }
    return { displayScore: "—", displayBand: "—", scorePct: null };
  }

  if (r.total > 0) {
    return { displayScore: `${r.score}/${r.total}`, displayBand: noBand ? "—" : (r.level || "—"), scorePct: r.score / r.total };
  }

  return { displayScore: "—", displayBand: noBand ? "—" : (r.level || "—"), scorePct: null };
};
