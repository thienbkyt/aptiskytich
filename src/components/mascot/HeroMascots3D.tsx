/**
 * Hero trang chủ: Kỳ Kỳ & Tích Tích 3D đứng trước cửa sổ sản phẩm.
 * Mỗi 5s đổi câu thoại, xen kẽ "đập tay" và "nhún cổ vũ". Máy không hỗ trợ → Tích Tích SVG như cũ.
 */
import { useEffect, useRef, useState } from "react";
import Mascot3D, { type Mascot3DApi } from "./Mascot3D";
import TichTich from "./TichTich";

const LINES = [
  "Thi thử miễn phí với tụi mình nha! 👋",
  "Kỳ Kỳ chấm Writing cho bạn ✍️",
  "Tích Tích luyện Speaking cùng bạn 🎙️",
  "Mục tiêu B2? Tụi mình giúp! 💪",
];

export default function HeroMascots3D() {
  const apiRef = useRef<Mascot3DApi | null>(null);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      setShow(false);
      window.setTimeout(() => {
        setIdx((i) => {
          const n = (i + 1) % LINES.length;
          if (n % 2) apiRef.current?.highFive(); else apiRef.current?.cheer();
          return n;
        });
        setShow(true);
      }, 300);
    }, 5000);
    return () => window.clearInterval(id);
  }, [ready]);

  return (
    <Mascot3D
      className="hidden lg:block absolute -bottom-16 -right-20 z-20 w-[520px] h-[400px]"
      scene={{ radius: 11.8, targetY: 1.75, theta: -0.22, phi: 1.38, spread: 1.7 }}
      onReady={(api) => { apiRef.current = api; setReady(true); window.setTimeout(() => api.highFive(), 900); }}
      fallback={<div className="hidden lg:block absolute -bottom-12 -right-8 z-20"><TichTich size={130} /></div>}
    >
      {ready && (
        <div
          className="absolute left-[24%] top-1 whitespace-nowrap rounded-2xl border border-[#F1D5C2] bg-white px-3.5 py-2 text-sm font-bold text-[#5a2a10] shadow-[0_8px_20px_rgba(0,0,0,0.1)] transition-all duration-300 pointer-events-none"
          style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(4px)" }}
        >
          {LINES[idx]}
          <span className="absolute left-[30%] top-full border-8 border-transparent border-t-white" />
        </div>
      )}
    </Mascot3D>
  );
}
