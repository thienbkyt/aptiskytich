/**
 * Trang trí Hoa 20/10 (15–20/10/2026, html.women2010):
 * - Vài bông hoa nhỏ, mờ ở 2 góc menu.
 * - Cánh hoa rơi nhẹ ở Trang chủ & Dashboard (≥768px, tôn trọng "giảm chuyển động").
 * - Tự ẩn khi đang làm bài / xem lại bài và ở /admin.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { isWomenDaySeason } from "@/lib/halloween";
import "./womenday.css";

const EXAM_CLASSES = ["exam-mode", "history-review-mode", "exam-fullscreen", "full-test-active"];

const Flower = () => (
  <svg viewBox="-50 -50 100 100">
    <g fill="#FFC9D6">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} rx="16" ry="30" cy="-20" transform={`rotate(${r})`} />
      ))}
    </g>
    <circle r="11" fill="#FFB27A" />
  </svg>
);

const CORNERS: { side: "left" | "right"; x: number; top: number; w: number; o: number; sm?: boolean }[] = [
  { side: "left", x: 6, top: 3, w: 11, o: 0.55 },
  { side: "left", x: 22, top: 12, w: 8, o: 0.4, sm: true },
  { side: "right", x: 64, top: 4, w: 10, o: 0.5, sm: true },
  { side: "right", x: 30, top: 13, w: 12, o: 0.6 },
  { side: "right", x: 8, top: 3, w: 7, o: 0.4 },
];

export default function WomenDayDecor() {
  const { pathname } = useLocation();
  const [inExam, setInExam] = useState(false);

  useEffect(() => {
    const check = () => setInExam(EXAM_CLASSES.some((c) => document.body.classList.contains(c)));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (!isWomenDaySeason() || inExam || pathname.startsWith("/admin")) return null;
  const petals = pathname === "/" || pathname.startsWith("/dashboard");

  return (
    <div aria-hidden className="wd-decor">
      {CORNERS.map((c, i) => (
        <span
          key={i}
          className={`wd-corner${c.sm ? " wd-sm" : ""}`}
          style={{ [c.side]: c.x, top: c.top, width: c.w, opacity: c.o } as React.CSSProperties}
        >
          <Flower />
        </span>
      ))}
      {petals && (
        <div className="wd-petals">
          {Array.from({ length: 12 }).map((_, i) => (
            <i
              key={i}
              className="wd-pt"
              style={{
                left: `${(i * 37 + 7) % 100}%`,
                animationDelay: `-${((i * 1.9) % 11).toFixed(1)}s`,
                animationDuration: `${(11 + (i % 5) * 1.8).toFixed(1)}s`,
                transform: `scale(${0.6 + (i % 4) * 0.15})`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
