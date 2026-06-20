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

  const snapScaled = snapshot && typeof snapshot.scaled50 === "number" ? snapshot.scaled50 : null;
  const snapBand = snapshot && typeof snapshot.band === "string" ? snapshot.band : null;
  if (snapScaled != null) {
    return {
      displayScore: `${snapScaled}/50`,
      displayBand: snapBand || (isAI ? getSkillBand(snapScaled, skill as any) : (r.level || "—")),
      scorePct: snapScaled / 50,
    };
  }

  if (isAI) {
    const agg = skill === "writing" ? writingAgg : speakingAgg;
    if (agg && agg.max > 0) {
      const scaled = Math.round((agg.sum / agg.max) * 50);
      return {
        displayScore: `${Number(agg.sum.toFixed(1))}/${agg.max}`,
        displayBand: getSkillBand(scaled, skill as any),
        scorePct: agg.sum / agg.max,
      };
    }
    return { displayScore: "—", displayBand: "—", scorePct: null };
  }

  if (r.total > 0) {
    return {
      displayScore: `${r.score}/${r.total}`,
      displayBand: r.level || "—",
      scorePct: r.score / r.total,
    };
  }
  return { displayScore: "—", displayBand: r.level || "—", scorePct: null };
};
