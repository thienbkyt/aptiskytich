// Auto-update PWA: when a new SW is ready, activate it and reload the page.
import { toast } from "sonner";

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Skip in dev / Lovable preview iframes
  if (!import.meta.env.PROD) return;

  // Dynamic import so dev builds don't break on the virtual module
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          try {
            toast("Đang cập nhật phiên bản mới...", { duration: 2000 });
          } catch {}
          // Activate the new SW and reload to pick up the latest bundle
          updateSW(true);
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
    })
    .catch(() => {
      /* ignore if virtual module not available */
    });
}
