/**
 * Global "student is taking an exam" flag.
 *
 * Reference-counted: in a Full Test both the parent engine and the per-skill
 * child engine mark the exam as active, and children unmount on every part
 * change. A boolean would flip off mid-test; a counter keeps the flag on until
 * the last engine has cleaned up.
 */
export const EXAM_ACTIVE_EVENT = "kt-exam-active-change";

let count = 0;

export function isExamActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.__ktExamActive;
}

function sync() {
  if (typeof window === "undefined") return;
  const active = count > 0;
  if (window.__ktExamActive === active) return; // only emit on real transitions
  window.__ktExamActive = active;
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
  count++;
  sync();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    sync();
  };
}
