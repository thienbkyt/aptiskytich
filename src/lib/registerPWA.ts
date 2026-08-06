// Prompt-based PWA update: notify the user, reload only at a safe moment.
//
// Rules:
// - Never prompt while an exam is in progress (window.__ktExamActive).
// - Dismissing the toast silences that exact build for 24 hours.
// - The toast auto-hides after 15s; it may come back on a later navigation.
// - When the student navigates to a non-exam page with an update waiting,
//   apply it silently (reloading there loses nothing).
import { toast } from "sonner";
import { EXAM_ACTIVE_EVENT, isExamActive } from "@/lib/examActive";
import { safeLocalStorage } from "@/lib/safeStorage";

const DISMISS_KEY = "kt-pwa-update-dismissed";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOCATION_EVENT = "kt-locationchange";

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

  // Dynamic import so dev builds don't break on the virtual module
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      let pendingBuildId: string | null = null;
      let registrationRef: ServiceWorkerRegistration | null = null;

      const buildIdOf = () =>
        registrationRef?.waiting?.scriptURL ||
        registrationRef?.installing?.scriptURL ||
        "pending-update";

      const showToast = () => {
        if (!pendingBuildId) return;
        if (isExamActive()) return;
        if (isDismissed(pendingBuildId)) return;
        const id = pendingBuildId;
        try {
          toast("Đã có bản cập nhật mới", {
            id: "pwa-update",
            duration: 15000,
            closeButton: true,
            onDismiss: () => rememberDismiss(id),
            action: {
              label: "Tải lại",
              onClick: () => {
                pendingBuildId = null;
                updateSW(true);
              },
            },
          });
        } catch {}
      };

      const applyWhenSafe = () => {
        if (!pendingBuildId) return;
        if (isExamActive()) return;
        // Safe spot: not in an exam → update straight away, no question asked.
        pendingBuildId = null;
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
      });

      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          pendingBuildId = buildIdOf();
          showToast();
        },
        onRegisteredSW(_swUrl, registration) {
          registrationRef = registration ?? null;
          // Periodically check for updates (every 30 minutes)
          if (registration) {
            setInterval(() => {
              registration.update().catch(() => {});
            }, 30 * 60 * 1000);
          }
        },
      });
    })
    .catch(() => {
      /* ignore if virtual module not available */
    });
}
