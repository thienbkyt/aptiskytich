import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ParticlesBackgroundProps {
  className?: string;
  /** Number of particles on desktop. */
  count?: number;
  /** Max distance to draw connecting lines. */
  linkDistance?: number;
  /** Color override (hex/rgb). Defaults to primary brand red. */
  color?: string;
}

/**
 * Lightweight canvas particle/network background.
 * - pointer-events-none, aria-hidden
 * - pauses when tab is hidden
 * - respects prefers-reduced-motion (renders nothing)
 * - skipped entirely on mobile (<768px) to keep scroll smooth
 */
const ParticlesBackground = ({
  className,
  count = 24,
  linkDistance = 130,
  color = "204, 28, 1", // brand red rgb
}: ParticlesBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const reduced = (() => {
      try {
        return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      } catch {
        return false;
      }
    })();
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = count;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (canvas.parentElement) ro?.observe(canvas.parentElement);
    if (!ro) window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    const particles: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.6,
    }));

    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.55)`;
        ctx.fill();
      }

      // O(N^2) links only for small particle counts; skip on larger sets.
      if (particles.length <= 28) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < linkDistance) {
              const alpha = (1 - dist / linkDistance) * 0.25;
              ctx.strokeStyle = `rgba(${color}, ${alpha})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (!ro) window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count, linkDistance, color, isMobile]);

  if (isMobile) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("particles-bg pointer-events-none absolute inset-0 w-full h-full", className)}
    />
  );
};

export default ParticlesBackground;
