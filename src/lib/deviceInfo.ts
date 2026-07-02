import { safeLocalStorage } from "@/lib/safeStorage";

const DEVICE_ID_KEY = "device_id";

export type DeviceType = "mobile" | "tablet" | "desktop";

export function getDeviceId(): string {
  let id = safeLocalStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
      `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    safeLocalStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const uaLower = ua.toLowerCase();
  // iPadOS 13+ reports as Mac; detect via touch
  const isIpadOS =
    /macintosh/.test(uaLower) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  if (/ipad/.test(uaLower) || isIpadOS || /tablet/.test(uaLower) || (/android/.test(uaLower) && !/mobile/i.test(ua))) {
    return "tablet";
  }
  if (/iphone|ipod|android.*mobile|windows phone|iemobile|blackberry|bb10|mobile safari/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Trình duyệt";
  const ua = navigator.userAgent || "";

  let os = "Khác";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)) os = "iOS";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Trình duyệt";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  return `${os} · ${browser}`;
}
