export type MarathonQResult = { exam_question_id: string; user_answer: string | null; is_correct: boolean };
export type MarathonResultEntry = { correct: number; total: number; examSetId: string; part: string; qResults: MarathonQResult[] };

export interface MarathonProgress {
  currentIndex: number;
  results: (MarathonResultEntry | null)[];
  /** Per-set draft answers keyed by examSetId (unsubmitted work-in-progress). */
  drafts?: Record<string, any>;
  /** Stable per-session id — one History row per session, updated as progress grows. */
  sessionId?: string;
  /** test_results.id created for this session on first save; updated thereafter. */
  testResultId?: string | null;
  updatedAt: number;
}
export interface MarathonLast {
  correct: number;
  total: number;
  wrongSetIds: string[];
  wrongQuestionsBySet?: Record<string, string[]>;
  /** Per-set score of the latest attempt for each set (merged across retries). */
  setResults?: Record<string, { correct: number; total: number }>;
  /** Number of sets in the original completed run (used to know when a retry fully covers every set). */
  setCount?: number;
  updatedAt: number;
}

const key = (skill: string, part: string) => `kt_marathon:${skill}:${part}`;
const lastKey = (skill: string, part: string) => `kt_marathon_last:${skill}:${part}`;

export function saveMarathonProgress(skill: string, part: string, data: MarathonProgress) {
  try { localStorage.setItem(key(skill, part), JSON.stringify(data)); } catch { /* noop */ }
}
export function loadMarathonProgress(skill: string, part: string): MarathonProgress | null {
  try { const r = localStorage.getItem(key(skill, part)); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearMarathonProgress(skill: string, part: string) {
  try { localStorage.removeItem(key(skill, part)); } catch { /* noop */ }
}
export function saveMarathonLast(skill: string, part: string, data: MarathonLast) {
  try { localStorage.setItem(lastKey(skill, part), JSON.stringify(normalizeMarathonLast(data))); } catch { /* noop */ }
}
export function normalizeMarathonLast(l: MarathonLast): MarathonLast {
  const wrongSetIds = l.wrongSetIds || [];
  let correct = l.correct;
  let wrongQuestionsBySet = l.wrongQuestionsBySet ? { ...l.wrongQuestionsBySet } : {};
  if (wrongSetIds.length === 0) {
    correct = l.total;
    wrongQuestionsBySet = {};
  } else {
    Object.keys(wrongQuestionsBySet).forEach((k) => {
      if (!wrongSetIds.includes(k)) delete wrongQuestionsBySet[k];
    });
  }
  return { ...l, correct, wrongSetIds, wrongQuestionsBySet };
}
export function loadMarathonLast(skill: string, part: string): MarathonLast | null {
  try {
    const r = localStorage.getItem(lastKey(skill, part));
    if (!r) return null;
    return normalizeMarathonLast(JSON.parse(r));
  } catch { return null; }
}
export function clearMarathonLast(skill: string, part: string) {
  try { localStorage.removeItem(lastKey(skill, part)); } catch { /* noop */ }
}

/**
 * Merge a "Làm lại câu sai" (retry) run into the previous marathon result so the
 * History row reflects the latest state instead of a standalone partial run.
 * Returns the merged MarathonLast (also persisted), or null when there is no
 * previous run to merge into.
 */
export function mergeMarathonLastAfterRetry(
  skill: string,
  part: string,
  retried: { examSetId: string; correct: number; total: number; wrongQuestionIds: string[] }[],
): MarathonLast | null {
  const last = loadMarathonLast(skill, part);
  if (!last) return null;

  const setResults: Record<string, { correct: number; total: number }> = { ...(last.setResults ?? {}) };
  for (const r of retried) setResults[r.examSetId] = { correct: r.correct, total: r.total };

  const retriedClean = new Set(retried.filter((r) => r.correct >= r.total).map((r) => r.examSetId));
  const wrongSetIds = last.wrongSetIds.filter((id) => !retriedClean.has(id));
  for (const r of retried) {
    if (r.correct < r.total && !wrongSetIds.includes(r.examSetId)) wrongSetIds.push(r.examSetId);
  }

  const wrongQuestionsBySet: Record<string, string[]> = { ...(last.wrongQuestionsBySet ?? {}) };
  for (const r of retried) {
    if (r.wrongQuestionIds.length) wrongQuestionsBySet[r.examSetId] = r.wrongQuestionIds;
    else delete wrongQuestionsBySet[r.examSetId];
  }

  const total = last.total;
  const complete = !!last.setCount && Object.keys(setResults).length >= last.setCount;
  const correct = complete
    ? Object.values(setResults).reduce((s, x) => s + x.correct, 0)
    : wrongSetIds.length === 0
      ? total
      : last.correct;

  const merged: MarathonLast = {
    ...last,
    correct,
    wrongSetIds,
    wrongQuestionsBySet,
    setResults: complete ? setResults : last.setResults,
    updatedAt: Date.now(),
  };
  saveMarathonLast(skill, part, merged);
  return merged;
}

/** Cryptographically-random enough session id. */
export function newMarathonSessionId(): string {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return `mth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
