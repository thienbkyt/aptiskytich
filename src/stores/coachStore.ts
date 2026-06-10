// Lightweight pub/sub store for AI Coach exam context.
// Exam engines call setCoachExamContext({...}) whenever the active
// question changes; the AI Coach panel reads from here.
import { useEffect, useState } from "react";

export type CoachExamContext = {
  skill?: string;        // "Grammar & Vocabulary", "Reading", ...
  part?: string | number;
  questionIndex?: number; // 0-based
  totalQuestions?: number;
  questionText?: string;
  options?: string[];
  userAnswer?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  isSubmitted?: boolean;
};

let state: CoachExamContext | null = null;
const listeners = new Set<() => void>();

export const coachStore = {
  get: () => state,
  set: (v: CoachExamContext | null) => {
    state = v;
    listeners.forEach((l) => l());
  },
  clear: () => {
    state = null;
    listeners.forEach((l) => l());
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function setCoachExamContext(v: CoachExamContext | null) {
  coachStore.set(v);
}

export function useCoachExamContext(): CoachExamContext | null {
  const [v, setV] = useState<CoachExamContext | null>(state);
  useEffect(() => {
    const unsub = coachStore.subscribe(() => setV(coachStore.get()));
    return () => { unsub(); };
  }, []);
  return v;
}
