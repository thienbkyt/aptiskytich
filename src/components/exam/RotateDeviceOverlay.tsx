import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCw } from "lucide-react";
import { getDeviceType } from "@/lib/deviceInfo";

/**
 * Full-screen overlay shown only on mobile phones held in portrait orientation.
 * Encourages the user to rotate to landscape for the exam UI.
 * - Only active when getDeviceType() === "mobile" (skips tablet/desktop).
 * - Auto-dismisses when device is rotated to landscape (no click required).
 * - iOS Safari does not support screen.orientation.lock(), so we only show a hint.
 */
const RotateDeviceOverlay = () => {
  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return getDeviceType() === "mobile";
    } catch {
      return false;
    }
  });
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(orientation: portrait)").matches;
  });

  useEffect(() => {
    if (!isMobile || typeof window === "undefined" || !window.matchMedia) return;
    const mm = window.matchMedia("(orientation: portrait)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsPortrait("matches" in e ? e.matches : mm.matches);
    };
    update(mm);
    // Modern + Safari fallback
    if (mm.addEventListener) {
      mm.addEventListener("change", update as (e: MediaQueryListEvent) => void);
      return () => mm.removeEventListener("change", update as (e: MediaQueryListEvent) => void);
    } else {
      // @ts-ignore - legacy Safari
      mm.addListener(update);
      // @ts-ignore
      return () => mm.removeListener(update);
    }
  }, [isMobile]);

  if (!isMobile || !isPortrait) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/85 px-6 text-center text-white"
      style={{ touchAction: "none" }}
      onTouchMove={(e) => e.preventDefault()}
    >
      <div className="max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
          <RotateCw className="h-10 w-10 animate-pulse text-white" />
        </div>
        <h2 className="mb-3 text-xl font-bold leading-snug">
          Xoay ngang màn hình để làm bài
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-white/85">
          Bài thi được thiết kế theo màn ngang. Vui lòng xoay ngang điện thoại để hiển thị đúng.
        </p>
        <p className="text-xs leading-relaxed text-white/60">
          Nếu xoay mà màn hình không đổi, hãy tắt Khoá xoay màn hình trong Trung tâm điều khiển.
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default RotateDeviceOverlay;
