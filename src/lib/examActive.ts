/**
 * Global "student is taking an exam" flag.
 *
 * Exam engines already toggled the body class "exam-active"; this helper keeps
 * that behaviour and additionally exposes window.__ktExamActive plus a change
 * event so non-React code (PWA update prompts, chunk-error banner) can stay
 * quiet while a test is in progress.
 */
export const EXAM_ACTIVE_EVENT = "kt-exam-active-change";

export function isExamActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__ktExamActive;
}

function setFlag(active: boolean) {
  if (typeof window === "undefined") return;
  (window as any).__ktExamActive = active;
  try {
    document.body.classList.toggle("exam-active", active);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(EXAM_ACTIVE_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Mark the exam as active. Returns a cleanup function, so engines can do:
 *   useEffect(() => markExamActive(), []);
 */
export function markExamActive(): () => void {
  setFlag(true);
  return () => setFlag(false);
}
