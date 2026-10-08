// Meta Pixel helpers — never throw, safe when the pixel is blocked/absent.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const AW_ID = "AW-18413343499";

export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
) {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq(
        "track",
        event,
        params ?? {},
        ...(eventId ? [{ eventID: eventId }] : []),
      );
    }
  } catch {
    /* ignore */
  }
}

export function trackOnce(
  key: string,
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
) {
  const storageKey = `kt_px_${key}`;
  try {
    if (localStorage.getItem(storageKey)) return;
  } catch {
    /* ignore */
  }
  trackPixel(event, params, eventId);
  try {
    localStorage.setItem(storageKey, "1");
  } catch {
    /* ignore */
  }
}
