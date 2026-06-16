import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";

export type ListeningHighlightData = {
  highlights: Record<string, string>;
};

export interface ListeningHighlightItem {
  id: string;
  script: string;
  context: string;
}

// Stable IDs
export const l1Id = (qi: number) => `l1-q${qi}`;
export const l2Id = (letter: string) => `l2-sp${letter}`;
export const l3Id = (statementIndex: number) => `l3-st${statementIndex}`;
export const l4Id = (clipIndex: number, qi: number) => `l4-c${clipIndex}-q${qi}`;

const ANSWER_LABEL: Record<string, string> = {
  man: "the man",
  woman: "the woman",
  both: "both speakers",
};

export interface ListeningHighlightPart {
  partType: "part1" | "part2" | "part3" | "part4";
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
}

export function buildHighlightRequest(part: ListeningHighlightPart): ListeningHighlightItem[] {
  const items: ListeningHighlightItem[] = [];

  if (part.partType === "part1" && part.part1Questions) {
    part.part1Questions.forEach((q, qi) => {
      if (!q.script) return;
      const correctOpt = q.options?.[q.correct] ?? "";
      items.push({
        id: l1Id(qi),
        script: q.script,
        context: `Question: ${q.questionText || "Which word do you hear?"} Correct answer: "${correctOpt}".`,
      });
    });
  } else if (part.partType === "part2" && part.part2Questions) {
    const q = part.part2Questions[0];
    if (q?.script) {
      q.persons.forEach((p) => {
        const info = q.infoItems.find((it) => it.correctPerson === p.name);
        if (!info) return;
        items.push({
          id: l2Id(p.name),
          script: q.script!,
          context: `Speaker ${p.name} matches the correct information: "${info.text}".`,
        });
      });
    }
  } else if (part.partType === "part3" && part.part3Questions) {
    const q = part.part3Questions[0];
    if (q?.script) {
      q.statements.forEach((s, si) => {
        items.push({
          id: l3Id(si),
          script: q.script!,
          context: `Statement: "${s.text}" — expressed by ${ANSWER_LABEL[s.correctAnswer] || s.correctAnswer}.`,
        });
      });
    }
  } else if (part.partType === "part4" && part.part4Questions) {
    part.part4Questions.forEach((clip, ci) => {
      if (!clip.script) return;
      clip.questions.forEach((qq, qi) => {
        const correctOpt = qq.options?.[qq.correct] ?? "";
        items.push({
          id: l4Id(ci, qi),
          script: clip.script!,
          context: `Question: ${qq.text} Correct answer: "${correctOpt}".`,
        });
      });
    });
  }

  return items;
}

/** Render a script with all given highlight spans wrapped in <mark>. Returns React-safe parts. */
export function highlightScript(script: string, spans: string[]): Array<{ text: string; mark: boolean }> {
  if (!script) return [];
  const valid = spans.filter((s) => s && script.includes(s));
  if (valid.length === 0) return [{ text: script, mark: false }];

  // Build a sorted list of [start, end] ranges, merging overlaps.
  const ranges: Array<[number, number]> = [];
  for (const span of valid) {
    let from = 0;
    while (from <= script.length) {
      const idx = script.indexOf(span, from);
      if (idx < 0) break;
      ranges.push([idx, idx + span.length]);
      from = idx + span.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: Array<{ text: string; mark: boolean }> = [];
  let cur = 0;
  for (const [s, e] of merged) {
    if (s > cur) out.push({ text: script.slice(cur, s), mark: false });
    out.push({ text: script.slice(s, e), mark: true });
    cur = e;
  }
  if (cur < script.length) out.push({ text: script.slice(cur), mark: false });
  return out;
}
