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
  try { localStorage.setItem(lastKey(skill, part), JSON.stringify(data)); } catch { /* noop */ }
}
export function loadMarathonLast(skill: string, part: string): MarathonLast | null {
  try { const r = localStorage.getItem(lastKey(skill, part)); return r ? JSON.parse(r) : null; } catch { return null; }
}

/** Cryptographically-random enough session id. */
export function newMarathonSessionId(): string {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return `mth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
