/**
 * Hero trang chủ: Kỳ Kỳ & Tích Tích 3D đứng trước cửa sổ sản phẩm.
 * Mỗi 5s đổi câu thoại, xen kẽ "đập tay" và "nhún cổ vũ". Máy không hỗ trợ → Tích Tích SVG như cũ.
 */
import { useEffect, useRef, useState } from "react";
import Mascot3D, { type Mascot3DApi } from "./Mascot3D";
import TichTich from "./TichTich";
import { isWomenDayThemeSeason } from "@/lib/halloween";
import "@/components/womenday/womenday.css";

const LINES = [
  "Thi thử miễn phí với tụi mình nha! 👋",
  "Kỳ Kỳ chấm Writing cho bạn ✍️",
  "Tích Tích luyện Speaking cùng bạn 🎙️",
  "Mục tiêu B2? Tụi mình giúp! 💪",
];

const WD_LINES = [
  "Chúc mừng ngày 20/10! 💐",
  "Chúc các bạn nữ luôn xinh & thi là đỗ 🌸",
  "Thi thử miễn phí với tụi mình nha! 👋",
  "Mục tiêu B2? Tụi mình giúp! 💪",
];
const EXTRUDE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** Chữ 20/10 khối 3D ánh kim đứng sau 2 linh vật (mùa 20/10). */
function WomenDayBackdrop() {
  return (
    <div aria-hidden className="hidden lg:block absolute -bottom-16 -right-20 z-10 w-[520px] h-[400px] pointer-events-none wdl-wrap">
      <div className="wdl-ring" />
      <div className="wdl-rig font-heading">
        {EXTRUDE.map((i) => (
          <div key={i} className="wdl-ex" style={{ transform: `translateZ(${-i * 2.2}px)`, color: i > 7 ? "#B81E4A" : i > 3 ? "#D9406A" : "#F07A9A" }}>20/10</div>
        ))}
        <div className="wdl-face">20/10</div>
      </div>
    </div>
  );
}

export default function HeroMascots3D() {
  const wd = isWomenDayThemeSeason();
  const lines = wd ? WD_LINES : LINES;
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
          const n = (i + 1) % lines.length;
          if (n % 2) apiRef.current?.highFive(); else apiRef.current?.cheer();
          if (wd) apiRef.current?.setMood(n === 0 || n === 1 ? "love" : "normal");
          return n;
        });
        setShow(true);
      }, 300);
    }, 5000);
    return () => window.clearInterval(id);
  }, [ready, wd, lines.length]);

  return (
    <>
    {wd && <WomenDayBackdrop />}
    <Mascot3D
      className="hidden lg:block absolute -bottom-16 -right-20 z-20 w-[520px] h-[400px]"
      scene={{ radius: 11.8, targetY: 1.75, theta: -0.22, phi: 1.38, spread: 1.7 }}
      onReady={(api) => { apiRef.current = api; setReady(true); window.setTimeout(() => api.highFive(), 900); if (wd) window.setTimeout(() => api.setMood("love"), 400); }}
      fallback={<div className="hidden lg:block absolute -bottom-12 -right-8 z-20"><TichTich size={130} /></div>}
    >
      {ready && (
        <div
          className={`absolute left-[24%] ${wd ? "-top-14" : "top-1"} whitespace-nowrap rounded-2xl border border-[#F1D5C2] bg-white px-3.5 py-2 text-sm font-bold text-[#5a2a10] shadow-[0_8px_20px_rgba(0,0,0,0.1)] transition-all duration-300 pointer-events-none`}
          style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(4px)" }}
        >
          {lines[idx]}
          <span className="absolute left-[30%] top-full border-8 border-transparent border-t-white" />
        </div>
      )}
    </Mascot3D>
    </>
  );
}
