import { useState } from "react";
import { getDeviceType } from "@/lib/deviceInfo";

/** localStorage override: "1" = luôn dùng UI điện thoại, "0" = luôn dùng UI máy tính. */
const FORCE_KEY = "kt_phone_ui";

/**
 * True khi học viên đang làm bài trên ĐIỆN THOẠI → dùng giao diện ôn tập dễ bấm.
 * Máy tính / iPad giữ nguyên giao diện thi thật.
 * Có thể ép bằng ?phoneui=1 / ?phoneui=0 trên URL (lưu lại vào localStorage).
 */
export function isPhoneExamUI(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("phoneui");
    if (q === "1" || q === "0") window.localStorage.setItem(FORCE_KEY, q);
    const f = window.localStorage.getItem(FORCE_KEY);
    if (f === "1") return true;
    if (f === "0") return false;
  } catch {
    /* ignore */
  }
  try {
    const t = getDeviceType();
    if (t === "mobile") return true;
    if (t === "tablet") return false;
    // UA "desktop" nhưng màn nhỏ + cảm ứng (vd. trình duyệt trong app) → vẫn coi là điện thoại
    const coarse = !!window.matchMedia?.("(pointer: coarse)").matches;
    const shortSide = Math.min(window.screen?.width || 9999, window.screen?.height || 9999);
    return coarse && shortSide < 600;
  } catch {
    return false;
  }
}

/** Giá trị cố định trong suốt vòng đời component (không đổi khi xoay máy). */
export function usePhoneExamUI(): boolean {
  const [v] = useState(isPhoneExamUI);
  return v;
}
