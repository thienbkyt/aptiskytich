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
  // Google Ads: same business outcomes, mapped to this account's conversion
  // actions. Any other event is not sent to Google.
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      if (event === "PageView") {
        window.gtag("event", "page_view", { send_to: AW_ID });
      } else if (event === "CompleteRegistration") {
        window.gtag("event", "conversion", {
          send_to: `${AW_ID}/HlaGCKuuz5UdEIumlcxE`,
        });
      } else if (event === "Purchase") {
        window.gtag("event", "conversion", {
          send_to: `${AW_ID}/xoQjCK6uz5UdEIumlcxE`,
          value: Number(params?.value ?? 0),
          currency: "VND",
          transaction_id: eventId ?? "",
        });
      }
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
