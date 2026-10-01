/**
 * Trang trí Halloween (chỉ khi theme = "halloween").
 * - Mạng nhện 2 góc trên + dây đèn bí ngô dưới navbar (desktop).
 * - Ma bay lên ngẫu nhiên từ 2 góc dưới (≥768px, tôn trọng "giảm chuyển động").
 * - Tự ẩn khi đang làm bài / xem lại bài và ở trang /admin.
 * Màu sắc nằm trong halloween.css (cũng tự tắt trong màn thi).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import "./halloween.css";

const EXAM_CLASSES = ["exam-mode", "history-review-mode", "exam-fullscreen", "full-test-active"];

const GHOST =
  '<svg viewBox="0 0 50 60" width="100%" height="100%"><path d="M25 2 C10 2 4 14 4 28 L4 56 L11 50 L18 56 L25 50 L32 56 L39 50 L46 56 L46 28 C46 14 40 2 25 2Z" fill="#fff" stroke="#c9b0e6" stroke-width="1.5"/><ellipse cx="18" cy="25" rx="3.5" ry="5" fill="#2a0f3d"/><ellipse cx="32" cy="25" rx="3.5" ry="5" fill="#2a0f3d"/><ellipse cx="25" cy="37" rx="4" ry="3" fill="#2a0f3d"/></svg>';

const R = (a: number, b: number) => a + Math.random() * (b - a);

export default function HalloweenDecor() {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const [inExam, setInExam] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setInExam(EXAM_CLASSES.some((c) => document.body.classList.contains(c)));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const on = theme === "halloween" && !inExam && !pathname.startsWith("/admin");

  // Ma bay lên từ góc dưới: vị trí, cỡ, đường bay ngẫu nhiên; tối đa 2 con cùng lúc.
  useEffect(() => {
    if (!on) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const spawn = () => {
      const box = boxRef.current;
      if (box && !document.hidden && box.querySelectorAll(".hw-gh").length < 2) {
        const W = box.clientWidth, H = box.clientHeight;
        const left = Math.random() < 0.6; // bên phải có Tích Tích & nút chat → ưu tiên bên trái
        const size = R(24, 40);
        const x0 = left ? R(10, 140) : W - R(90, 200);
        const drift = R(40, 150) * (left ? 1 : -1);
        const top = H * R(0.22, 0.5);
        const el = document.createElement("div");
        el.className = "hw-gh";
        el.style.width = `${size}px`;
        el.style.height = `${size * 1.2}px`;
        el.innerHTML = GHOST;
        box.appendChild(el);
        const kf: Keyframe[] = [];
        const amp = R(10, 22);
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const y = H + 20 - (H + 20 - top) * t;
          const x = x0 + drift * t + Math.sin(t * Math.PI * 2.4) * amp;
          const op = t < 0.15 ? (t / 0.15) * 0.85 : t > 0.75 ? ((1 - t) / 0.25) * 0.85 : 0.85;
          kf.push({ transform: `translate(${x}px, ${y}px) rotate(${Math.sin(t * 9) * 8}deg)`, opacity: op });
        }
        const anim = el.animate(kf, { duration: R(7000, 11000), easing: "ease-out" });
        anim.onfinish = () => el.remove();
      }
      timer = window.setTimeout(spawn, R(3000, 7000));
    };
    timer = window.setTimeout(spawn, 1500);
    return () => {
      clearTimeout(timer);
      boxRef.current?.querySelectorAll(".hw-gh").forEach((n) => n.remove());
    };
  }, [on]);

  if (!on) return null;

  return (
    <div aria-hidden className="hw-decor">
      <svg className="hw-web hw-web-l" viewBox="0 0 100 100">
        <g stroke="#a98cc9" strokeWidth=".8" fill="none">
          <path d="M0 0 L100 0 M0 0 L0 100 M0 0 L90 45 M0 0 L45 90 M0 0 L70 70" />
          <path d="M20 0 Q14 6 0 20 M40 0 Q28 14 0 40 M62 0 Q44 22 0 62 M84 0 Q60 30 0 84" />
        </g>
      </svg>
      <svg className="hw-web hw-web-r" viewBox="0 0 100 100">
        <g stroke="#a98cc9" strokeWidth=".8" fill="none">
          <path d="M0 0 L100 0 M0 0 L0 100 M0 0 L90 45 M0 0 L45 90 M0 0 L70 70" />
          <path d="M20 0 Q14 6 0 20 M40 0 Q28 14 0 40 M62 0 Q44 22 0 62 M84 0 Q60 30 0 84" />
        </g>
      </svg>
      <svg className="hw-garland" viewBox="0 0 1200 22" preserveAspectRatio="none">
        <path d="M0 2 Q150 20 300 4 T600 4 T900 4 T1200 2" stroke="#5b3a7a" strokeWidth="1.5" fill="none" />
        <g fill="#FF8A2A">
          {[75, 225, 375, 525, 675, 825, 975, 1125].map((x) => <circle key={x} cx={x} cy={12} r={5} />)}
        </g>
        <g fill="#B455FF">
          {[150, 450, 750, 1050].map((x) => <circle key={x} cx={x} cy={16} r={3.5} />)}
        </g>
      </svg>
      <div ref={boxRef} className="hw-ghosts" />
    </div>
  );
}
