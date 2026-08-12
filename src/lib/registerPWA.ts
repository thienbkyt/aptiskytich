// Prompt-based PWA update: notify the user, reload only at a safe moment.
//
// Rules:
// - Never prompt while an exam is in progress (window.__ktExamActive).
// - Dismissing the toast silences that exact build for 24 hours.
// - The toast auto-hides after 15s; it may come back on a later navigation.
// - When the student navigates to a non-exam page with an update waiting,
//   apply it silently (reloading there loses nothing).
import { toast } from "sonner";
import { EXAM_ACTIVE_EVENT, isExamActive, isFullTestActive } from "@/lib/examActive";
import { safeLocalStorage } from "@/lib/safeStorage";

const DISMISS_KEY = "kt-pwa-update-dismissed";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOCATION_EVENT = "kt-locationchange";

// Real build id (injected by vite define). registration.waiting.scriptURL is
// always "/sw.js", so it can't distinguish builds.
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

// Module-level handles so exam entry screens can force-apply a waiting update.
let updatePending = false;
let applyUpdate: ((reload: boolean) => Promise<void>) | null = null;

/**
 * Apply a waiting service-worker update RIGHT NOW (reloads the page).
 * Call this only from screens where nothing can be lost — typically the exam
 * instructions/prompt screen, BEFORE the student presses start. Never called
 * automatically while an exam is in progress.
 *
 * Returns true when an update was applied (page is about to reload).
 */
export function applyUpdateIfPending(): boolean {
  if (!updatePending || !applyUpdate) return false;
  // A Full Test keeps answers across skills → a reload would lose them.
  if (isFullTestActive()) return false;
  updatePending = false;
  try {
    toast.dismiss("pwa-update");
  } catch {}
  void applyUpdate(true);
  return true;
}

function isDismissed(buildId: string) {
  try {
    const raw = safeLocalStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { id?: string; at?: number };
    if (!parsed?.id || parsed.id !== buildId) return false;
    return Date.now() - Number(parsed.at || 0) < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function rememberDismiss(buildId: string) {
  safeLocalStorage.setItem(DISMISS_KEY, JSON.stringify({ id: buildId, at: Date.now() }));
}

// Emit a single "location changed" event for both push/replace and back/forward.
function patchHistory() {
  const w = window as any;
  if (w.__ktHistoryPatched) return;
  w.__ktHistoryPatched = true;
  const fire = () => {
    try {
      window.dispatchEvent(new Event(LOCATION_EVENT));
    } catch {
      /* ignore */
    }
  };
  (["pushState", "replaceState"] as const).forEach((name) => {
    const original = history[name];
    history[name] = function (this: History, ...args: any[]) {
      const result = (original as any).apply(this, args);
      fire();
      return result;
    } as any;
  });
  window.addEventListener("popstate", fire);
}

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Skip in dev / Lovable preview iframes
  if (!import.meta.env.PROD) return;

  patchHistory();

  let lastPathname = window.location.pathname;

  // Dynamic import so dev builds don't break on the virtual module
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const showToast = () => {
        if (!updatePending) return;
        if (isExamActive()) return;
        if (isDismissed(BUILD_ID)) return;
        try {
          toast("Đã có bản cập nhật mới", {
            id: "pwa-update",
            duration: 15000,
            closeButton: true,
            onDismiss: () => rememberDismiss(BUILD_ID),
            action: {
              label: "Tải lại",
              onClick: () => {
                updatePending = false;
                updateSW(true);
              },
            },
          });
        } catch {}
      };

      const applyWhenSafe = () => {
        if (!updatePending) return;
        if (isExamActive()) return;
        // Only a real page change counts. Practice screens sync state via
        // setSearchParams(replace), so query/hash-only changes must be ignored.
        const pathname = window.location.pathname;
        if (pathname === lastPathname) return;
        lastPathname = pathname;
        // Note: dismissing the toast only silences the toast — it never blocks
        // this silent auto-update on navigation.
        updatePending = false;
        toast.dismiss("pwa-update");
        updateSW(true);
      };

      // Left the exam screen → it is now fine to mention (or apply) the update.
      window.addEventListener(EXAM_ACTIVE_EVENT, () => {
        if (!isExamActive()) showToast();
      });
      // Navigated somewhere outside the exam → apply silently.
      window.addEventListener(LOCATION_EVENT, () => {
        applyWhenSafe();
        lastPathname = window.location.pathname;
      });

      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          updatePending = true;
          applyUpdate = updateSW;
          showToast();
        },
        onRegisteredSW(_swUrl, registration) {
          // Periodically check for updates (every 30 minutes)
          if (registration) {
            setInterval(() => {
              registration.update().catch(() => {});
            }, 30 * 60 * 1000);
          }
        },
      });
      applyUpdate = updateSW;
    })
    .catch(() => {
      /* ignore if virtual module not available */
    });
}
