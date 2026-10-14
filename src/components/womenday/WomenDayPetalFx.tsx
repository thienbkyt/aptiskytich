/**
 * Cánh hoa tương tác 20/10 (Trang chủ + Dashboard):
 * - Máy tính: rê chuột có vệt cánh hoa nhẹ; click chỗ trống thì bung hoa.
 * - Điện thoại: chạm để bung (không có vệt).
 * - Component khác gọi wdBurst(x, y) để bung ở 1 điểm (vd. bó hoa ở hero).
 * - Giới hạn số cánh hoa, tự dừng vẽ khi không còn cánh nào; tắt khi "giảm chuyển động".
 */
import { useEffect, useRef } from "react";

export function wdBurst(x: number, y: number, n = 16, pow = 1) {
  window.dispatchEvent(new CustomEvent("wd-burst", { detail: { x, y, n, pow } }));
}

type Petal = {
  x: number; y: number; vx: number; vy: number; s: number;
  rot: number; vr: number; ph: number; vp: number; life: number; max: number; c: [string, string];
};
type Bloom = { x: number; y: number; t: number };

const COLS: [string, string][] = [
  ["#FFD1DD", "#FF7FA2"], ["#FFC2D2", "#E8476F"], ["#FFE3C2", "#FF9A6A"], ["#FFB3C6", "#D81E2C"], ["#FFF0F4", "#FF9DB6"],
];
const MAX = 140;
const SKIP = "a,button,input,textarea,select,label,[role=button],[contenteditable=true],.wd-pop";

export default function WomenDayPetalFx() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    let W = 0, H = 0, raf = 0, running = false;
    const P: Petal[] = [];
    const B: Bloom[] = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    const add = (x: number, y: number, vx: number, vy: number, s: number, life: number) => {
      if (P.length >= MAX) P.shift();
      P.push({ x, y, vx, vy, s, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2, ph: Math.random() * 6.28,
        vp: 0.08 + Math.random() * 0.1, life, max: life, c: COLS[(Math.random() * COLS.length) | 0] });
      start();
    };
    const burst = (x: number, y: number, n: number, pow: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, v = (1.5 + Math.random() * 3.5) * pow;
        add(x, y, Math.cos(a) * v, Math.sin(a) * v - 2.2, 7 + Math.random() * 6, 70 + Math.random() * 50);
      }
    };

    const drawPetal = (p: Petal) => {
      const s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.2, Math.abs(Math.cos(p.ph))), 1);
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, p.c[0]); g.addColorStop(1, p.c[1]);
      ctx.fillStyle = g;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6) * 0.95;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(s * 0.95, s * 0.35, s * 0.75, -s * 0.85, s * 0.12, -s);
      ctx.lineTo(0, -s * 0.78);
      ctx.lineTo(-s * 0.12, -s);
      ctx.bezierCurveTo(-s * 0.75, -s * 0.85, -s * 0.95, s * 0.35, 0, s);
      ctx.fill();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, s * 0.8); ctx.lineTo(0, -s * 0.5); ctx.stroke();
      ctx.restore();
    };
    const drawBloom = (b: Bloom) => {
      const k = b.t / 40, sc = Math.min(1, k * 2.2), a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(k * 1.2); ctx.scale(sc, sc);
      ctx.globalAlpha = a * 0.95;
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        const g = ctx.createLinearGradient(0, 0, 0, -22);
        g.addColorStop(0, "#FF6F9A"); g.addColorStop(1, "#FFD1DD");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, -12, 7, 12, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#FFD25A";
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.restore();
    };

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.vy += 0.045; p.vx *= 0.985; p.vy *= 0.985; p.vx += Math.sin(p.ph * 0.5) * 0.03;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.ph += p.vp; p.life--;
        if (p.life <= 0 || p.y > H + 30) { P.splice(i, 1); continue; }
        drawPetal(p);
      }
      for (let i = B.length - 1; i >= 0; i--) {
        const b = B[i]; b.t++;
        if (b.t > 40) { B.splice(i, 1); continue; }
        drawBloom(b);
      }
      if (P.length || B.length) raf = requestAnimationFrame(tick);
      else { running = false; ctx!.clearRect(0, 0, W, H); }
    }

    let lx: number | null = null, ly = 0, acc = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (lx == null) { lx = e.clientX; ly = e.clientY; return; }
      const dx = e.clientX - lx, dy = e.clientY - ly;
      acc += Math.hypot(dx, dy); lx = e.clientX; ly = e.clientY;
      if (acc > 26) {
        acc = 0;
        add(e.clientX, e.clientY, dx * 0.04 + (Math.random() - 0.5) * 0.6, dy * 0.04 - 0.4, 5 + Math.random() * 4, 55 + Math.random() * 30);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(SKIP)) return;
      B.push({ x: e.clientX, y: e.clientY, t: 0 });
      burst(e.clientX, e.clientY, 16, 1);
    };
    const onBurst = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      burst(d.x, d.y, d.n ?? 16, d.pow ?? 1);
    };
    const onLeave = () => { lx = null; };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("wd-burst", onBurst);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wd-burst", onBurst);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="wd-fx" aria-hidden />;
}
