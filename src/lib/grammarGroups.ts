/**
 * Grammar & Vocabulary page grouping — MUST mirror GrammarExamEngine's grouping
 * logic so review navigator chips line up 1:1 with the pages the engine renders.
 *
 * The engine merges consecutive `vocab_matching` questions that share the same
 * groupable `vocabType` into a single page; every other question is its own page.
 */
const GROUPABLE_VOCAB_TYPES = [
  "synonym",
  "sentence_definition",
  "gap_fill",
  "definition_matching",
  "collocation",
] as const;

type AnyQuestion = {
  question_type?: string | null;
  correct_answer?: number | null;
  extra_data?: Record<string, any> | null;
};

const groupType = (q: AnyQuestion | undefined): string | null => {
  if (!q || q.question_type !== "vocab_matching") return null;
  const vt = (q.extra_data as any)?.vocabType;
  return (GROUPABLE_VOCAB_TYPES as readonly string[]).includes(vt) ? vt : null;
};

/**
 * Questions the engine actually renders — it drops rows with a missing
 * `correct_answer`, so snapshot items must be filtered the same way.
 */
export function gradableGrammarQuestions<T extends AnyQuestion>(rows: T[]): T[] {
  return (rows || []).filter(
    (r) => r?.correct_answer !== null && r?.correct_answer !== undefined,
  );
}

/** Index groups (into the gradable list) matching the engine's pages. */
export function grammarGroupIndices(rows: AnyQuestion[]): number[][] {
  const qs = gradableGrammarQuestions(rows || []);
  const groups: number[][] = [];
  let i = 0;
  while (i < qs.length) {
    const vt = groupType(qs[i]);
    if (vt) {
      const indices = [i];
      let j = i + 1;
      while (j < qs.length && groupType(qs[j]) === vt) {
        indices.push(j);
        j++;
      }
      groups.push(indices);
      i = j;
    } else {
      groups.push([i]);
      i++;
    }
  }
  return groups;
}
