// Prompt-based PWA update: notify user, reload only when they click.
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
            toast("Đã có bản cập nhật mới", {
              id: "pwa-update",
              duration: Infinity,
              closeButton: true,
              action: {
                label: "Tải lại",
                onClick: () => {
                  updateSW(true);
                },
              },
            });
          } catch {}
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
