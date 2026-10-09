/**
 * Kỳ Kỳ & Tích Tích bản 3D (three.js r128 tải từ CDN khi cần — không tăng bundle).
 * - Chỉ bật trên máy tính (≥ minWidth, có chuột), có WebGL, không bật "giảm chuyển động".
 *   Ngược lại (hoặc tải lỗi) → hiện `fallback` (bản SVG).
 * - Tự tạm dừng khi cuộn khỏi màn hình; theo giao diện Halloween (html.halloween).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
let threePromise: Promise<boolean> | null = null;

function loadThree(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).THREE?.WebGLRenderer) return Promise.resolve(true);
  if (threePromise) return threePromise;
  threePromise = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = THREE_URL;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(!!(window as any).THREE?.WebGLRenderer);
    s.onerror = () => { threePromise = null; resolve(false); };
    document.head.appendChild(s);
  });
  return threePromise;
}

function canUse3D(minWidth: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.innerWidth < minWidth) return false;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export interface Mascot3DApi {
  highFive: () => void;
  cheer: () => void;
  setMood: (m: "normal" | "happy" | "love" | "surprise") => void;
}

interface Props {
  /** Tuỳ chọn camera/bố cục cho cảnh (radius, targetY, theta, phi, spread). */
  scene?: Record<string, number | boolean>;
  fallback?: ReactNode;
  minWidth?: number;
  className?: string;
  style?: CSSProperties;
  onReady?: (api: Mascot3DApi) => void;
  children?: ReactNode;
}

export default function Mascot3D({ scene, fallback = null, minWidth = 1024, className, style, onReady, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"pending" | "3d" | "fallback">(() => (canUse3D(minWidth) ? "pending" : "fallback"));
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (mode !== "pending") return;
    let api: any = null;
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    (async () => {
      const ok = await loadThree();
      if (cancelled) return;
      if (!ok || !wrapRef.current) { setMode("fallback"); return; }
      try {
        const { initMascot3D } = await import("@/lib/mascot3d/scene");
        if (cancelled || !wrapRef.current) return;
        api = initMascot3D(wrapRef.current, { transparent: true, ...(scene || {}) });
        setMode("3d");
        const hw = () => api?.setHW(document.documentElement.classList.contains("halloween"));
        hw();
        mo = new MutationObserver(hw);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        io = new IntersectionObserver(([e]) => api?.setPaused(!e.isIntersecting), { threshold: 0 });
        io.observe(wrapRef.current);
        onReadyRef.current?.({ highFive: api.highFive, cheer: api.cheer, setMood: api.setMood });
      } catch (e) {
        console.warn("[Mascot3D] init failed", e);
        if (!cancelled) setMode("fallback");
      }
    })();
    return () => {
      cancelled = true;
      io?.disconnect();
      mo?.disconnect();
      try { api?.destroy(); } catch { /* noop */ }
    };
  // Chỉ khởi tạo 1 lần khi mount (đổi mode sang "3d" KHÔNG được huỷ cảnh).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "fallback") return <>{fallback}</>;
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <div ref={wrapRef} style={{ position: "absolute", inset: 0 }} />
      {children}
    </div>
  );
}
