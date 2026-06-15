import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";

export type ReadingReviewData = {
  translations: Record<string, string>;
  part3Evidence: Record<string, { person: string; sentence: string }>;
};

// Stable IDs used as keys in `translations`.
export const part1ItemId = (gapIndex: number) => `p1-g${gapIndex}`;
export const part2ItemId = (sectionIdx: number, correctPosition: number) =>
  `p2-s${sectionIdx}-p${correctPosition}`;
export const part4ItemId = (headingIdx: number) => `p4-h${headingIdx}`;

const PERSON_LETTERS = ["A", "B", "C", "D"];

/** Find the sentence in `passage` containing the `{gi}` placeholder, then
 *  substitute all `{n}` placeholders in that sentence with the correct option. */
export function buildPart1SentenceForGap(q: ReadingSentenceQuestion, gi: number): string {
  const marker = `{${gi}}`;
  const idx = q.passage.indexOf(marker);
  if (idx < 0) return "";
  const before = q.passage.slice(0, idx);
  const after = q.passage.slice(idx);
  const startRel = before.search(/[.!?\n][^.!?\n]*$/);
  const start = startRel >= 0 ? startRel + 1 : 0;
  const afterMatch = after.search(/[.!?\n]/);
  const end = afterMatch >= 0 ? idx + afterMatch + 1 : q.passage.length;
  let sentence = q.passage.slice(start, end).trim();
  sentence = sentence.replace(/\{(\d+)\}/g, (_m, n) => {
    const gap = q.gaps[parseInt(n)];
    if (!gap) return "___";
    return gap.options[gap.correct] ?? "___";
  });
  return sentence;
}

export interface TranslateReviewItem { id: string; text: string }
export interface TranslateReviewPart3 {
  questionIndex: number;
  questionText: string;
  blocks: Record<string, string>;
  correctPerson: string;
}

/** Build the request body items for translate-review based on the part snapshot. */
export function buildReviewRequest(part: {
  partType: "part1" | "part2" | "part3" | "part4";
  part1Question?: ReadingSentenceQuestion;
  part2Question?: ReadingCohesionQuestion;
  part3Question?: ReadingOpinionQuestion;
  part4Question?: ReadingLongQuestion;
}): { items: TranslateReviewItem[]; part3: TranslateReviewPart3[] } {
  const items: TranslateReviewItem[] = [];
  const part3: TranslateReviewPart3[] = [];

  if (part.partType === "part1" && part.part1Question) {
    part.part1Question.gaps.forEach((_g, gi) => {
      const text = buildPart1SentenceForGap(part.part1Question!, gi);
      if (text) items.push({ id: part1ItemId(gi), text });
    });
  } else if (part.partType === "part2" && part.part2Question) {
    part.part2Question.sections.forEach((sec, sIdx) => {
      sec.sentences.forEach((s) => {
        items.push({ id: part2ItemId(sIdx, s.correctPosition), text: s.text });
      });
    });
  } else if (part.partType === "part3" && part.part3Question) {
    const q = part.part3Question;
    const blocks: Record<string, string> = {};
    q.people.forEach((p, i) => {
      const letter = PERSON_LETTERS[i] ?? String(i);
      blocks[letter] = p.text;
    });
    q.statements.forEach((stmt, qi) => {
      const correctLetter = PERSON_LETTERS[stmt.correctPerson] ?? "A";
      part3.push({
        questionIndex: qi,
        questionText: stmt.text,
        blocks,
        correctPerson: correctLetter,
      });
    });
  } else if (part.partType === "part4" && part.part4Question) {
    (part.part4Question.headings || []).forEach((h, hi) => {
      items.push({ id: part4ItemId(hi), text: h.text });
    });
  }

  return { items, part3 };
}

export const personLetterToIndex = (letter: string): number => {
  const i = PERSON_LETTERS.indexOf(letter.toUpperCase());
  return i >= 0 ? i : 0;
};
