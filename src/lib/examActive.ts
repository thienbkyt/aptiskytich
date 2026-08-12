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

type ExamWindow = Window & { __ktExamActive?: boolean };

export function isExamActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as ExamWindow).__ktExamActive;
}

function sync() {
  if (typeof window === "undefined") return;
  const active = count > 0;
  const w = window as ExamWindow;
  if (w.__ktExamActive === active) return; // only emit on real transitions
  w.__ktExamActive = active;
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

/**
 * Marks a Full Test session as running. A Full Test carries answers across
 * skills, so a reload there DOES lose data — even on an instructions screen.
 */
let fullTestCount = 0;
type FullTestWindow = Window & { __ktFullTestActive?: boolean };

export function isFullTestActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as FullTestWindow).__ktFullTestActive;
}

export function markFullTestActive(): () => void {
  fullTestCount++;
  if (typeof window !== "undefined") (window as FullTestWindow).__ktFullTestActive = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fullTestCount = Math.max(0, fullTestCount - 1);
    if (typeof window !== "undefined") {
      (window as FullTestWindow).__ktFullTestActive = fullTestCount > 0;
    }
  };
}
