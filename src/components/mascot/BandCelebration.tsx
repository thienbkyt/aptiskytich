/**
 * Màn ăn mừng khi đạt band: Kỳ Kỳ & Tích Tích 3D đập tay + pháo giấy.
 * Hiện khi CEFR ≥ mục tiêu (Aim) của học viên; chưa đặt mục tiêu → từ B2 trở lên.
 * Điện thoại / máy không hỗ trợ 3D → hình SVG hai bạn vẫn có pháo giấy.
 */
import { useCallback, useEffect, useRef } from "react";
import Mascot3D, { type Mascot3DApi } from "./Mascot3D";
import KyKy from "./KyKy";
import TichTich from "./TichTich";
import { useUserGoal } from "@/hooks/useUserGoal";

const RANK: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5, C1: 5, C2: 6 };
const rankOf = (s?: string | null) => {
  const m = String(s || "").toUpperCase().match(/^(A0|A1|A2|B1|B2|C1|C2|C)/);
  return m ? RANK[m[1]] : -1;
};

function useConfetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  const parts = useRef<any[]>([]);
  const raf = useRef(0);
  const fire = useCallback(() => {
    const cv = ref.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const cols = ["#CC1C01", "#FEAD5F", "#FFC531", "#FF8FB1", "#7B5CFF", "#2BC48A"];
    for (let i = 0; i < 140; i++) {
      parts.current.push({
        x: cv.width * (0.2 + 0.6 * Math.random()), y: cv.height * 0.4,
        vx: (Math.random() - 0.5) * 13 * dpr, vy: -(7 + Math.random() * 11) * dpr,
        r: (4 + Math.random() * 5) * dpr, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, life: 0,
      });
    }
    if (raf.current) return;
    const ctx = cv.getContext("2d")!;
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.current = parts.current.filter((p) => p.life < 200 && p.y < cv.height + 40);
      for (const p of parts.current) {
        p.life++; p.vy += 0.33 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); ctx.restore();
      }
      raf.current = parts.current.length ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  return { ref, fire };
}

export default function BandCelebration({ cefr, skillLabel }: { cefr?: string | null; skillLabel?: string }) {
  const { goal, loading } = useUserGoal();
  const apiRef = useRef<Mascot3DApi | null>(null);
  const { ref: confettiRef, fire } = useConfetti();
  const target = goal?.aim || "B2";
  const reached = rankOf(cefr) >= 0 && rankOf(cefr) >= rankOf(target);

  const party = useCallback(() => {
    fire();
    apiRef.current?.highFive();
    window.setTimeout(() => apiRef.current?.cheer(), 2000);
  }, [fire]);

  useEffect(() => {
    if (!reached || loading) return;
    const t = window.setTimeout(fire, 400);
    return () => window.clearTimeout(t);
  }, [reached, loading, fire]);

  if (loading || !reached) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F0D9C8] bg-[radial-gradient(ellipse_at_50%_100%,#FFE3CC_0%,#FFF4EA_45%,#FFFFFF_80%)] dark:bg-card">
      <canvas ref={confettiRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />
      <Mascot3D
        className="h-[240px] w-full"
        minWidth={768}
        scene={{ radius: 10.2, targetY: 1.85, theta: 0, phi: 1.45, spread: 1.75 }}
        onReady={(api) => { apiRef.current = api; window.setTimeout(() => api.highFive(), 500); window.setTimeout(() => api.cheer(), 2500); }}
        fallback={
          <div className="kt-band-cel flex items-end justify-center gap-4 pt-6">
            {/* Linh vật SVG mặc định ẩn trên máy cảm ứng — riêng màn ăn mừng thì cho hiện */}
            <style>{"@media (hover:none),(pointer:coarse){.kt-band-cel .tt-robot,.kt-band-cel .kk-robot{display:block!important}}"}</style>
            <KyKy size={92} mood="happy" interactive={false} />
            <TichTich size={92} mood="happy" interactive={false} />
          </div>
        }
      />
      <div className="relative z-0 px-4 pb-5 pt-1 text-center">
        <p className="text-xs font-semibold text-primary">🏆 {skillLabel ? `Hoàn thành ${skillLabel}` : "Hoàn thành bài thi"}</p>
        <h3 className="mt-1 text-2xl font-heading font-extrabold text-foreground">
          Chúc mừng! Bạn đạt{" "}
          <span className="bg-gradient-to-r from-[#CC1C01] via-[#E85A1F] to-[#FEAD5F] bg-clip-text text-transparent">{cefr}</span> 🎉
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {goal ? `Bạn đã chạm mục tiêu ${goal.aim} — Kỳ Kỳ & Tích Tích tự hào về bạn lắm!` : "Kỳ Kỳ & Tích Tích tự hào về bạn lắm!"}
        </p>
        <button
          type="button"
          onClick={party}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-primary bg-white px-4 py-1.5 text-sm font-bold text-primary hover:bg-primary/5 dark:bg-transparent"
        >
          🙌 Đập tay lại
        </button>
      </div>
    </div>
  );
}
