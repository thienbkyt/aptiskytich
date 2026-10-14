/**
 * Hero Dashboard mùa 20/10: nền đỏ rượu–hồng, chữ 20/10 khối 3D ánh kim,
 * Tích Tích (đổi mặt theo nhịp, mắt nhìn chuột, tim bay) ôm bó hoa.
 * Rê chuột lên hero → cả cụm nghiêng 3D; click bó hoa → bung hoa + câu chúc.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import TichTich, { type TichTichMood } from "@/components/mascot/TichTich";
import WomenDayBouquet, { WomenDayBouquetDefs } from "./WomenDayBouquet";
import { wdBurst } from "./WomenDayPetalFx";
import "./womenday.css";

const CYCLE: TichTichMood[] = ["love", "wink", "laugh", "star", "happy"];
const TT_LINES = ["Chúc mừng 20/10! 🌸", "Tặng bạn bó hoa nè 💐", "Học đúng – ôn trúng nha! 💖"];
const BQ_LINES = ["Tặng bạn nè! 🌷", "Chúc bạn 20/10 thật xinh! 💖", "Học đúng – ôn trúng nha! 🌸", "Thi là đỗ nhé! 🎉"];
const EXTRUDE = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const HEART_SVG =
  '<svg viewBox="0 0 24 22"><path d="M12 21C5 15.5 1 12 1 7a5.5 5.5 0 0 1 11-1 5.5 5.5 0 0 1 11 1c0 5-4 8.5-11 14Z" fill="url(#wdb-pink)"/><ellipse cx="7" cy="6" rx="2.6" ry="1.6" fill="#fff" opacity=".7" transform="rotate(-30 7 6)"/></svg>';

interface Props {
  name: ReactNode;
  sub: ReactNode;
  actions: ReactNode;
  stats: ReactNode;
}

export default function WomenDayHero({ name, sub, actions, stats }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const bqRef = useRef<HTMLDivElement>(null);
  const heartsRef = useRef<HTMLDivElement>(null);
  const [mi, setMi] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleIdx = useRef(0);
  const bubbleTimer = useRef<number>();

  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tích Tích đổi mặt theo nhịp
  useEffect(() => {
    const t = window.setInterval(() => setMi((x) => (x + 1) % CYCLE.length), 2600);
    return () => window.clearInterval(t);
  }, []);

  // Xoay 3D theo chuột (không rê thì tự đung đưa); dừng khi hero ra khỏi màn hình
  useEffect(() => {
    const hero = heroRef.current, stage = stageRef.current, rig = rigRef.current;
    if (!hero || !stage || !rig || reduce) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, hover = false, raf = 0, visible = true;
    const t0 = performance.now();
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      hover = true;
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.4)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 1.4)));
    };
    const onLeave = () => { hover = false; };
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (!hover) { const k = (now - t0) / 1000; tx = Math.sin(k * 0.6) * 0.35; ty = Math.cos(k * 0.45) * 0.18; }
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      rig.style.transform = `rotateY(${(cx * 16).toFixed(2)}deg) rotateX(${(-cy * 11).toFixed(2)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; kick(); });
    io.observe(hero);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", kick);
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", kick);
    };
  }, [reduce]);

  // Tim bay quanh Tích Tích
  const spawnHearts = (count: number) => {
    const box = heartsRef.current;
    if (!box || reduce) return;
    for (let k = 0; k < count; k++) {
      const e = document.createElement("div");
      const s = 12 + Math.random() * 12;
      e.className = "wdh-ht";
      e.style.cssText = `left:${50 + Math.random() * 110}px;top:${140 + Math.random() * 30}px;width:${s}px;height:${s}px;--dx:${((Math.random() - 0.5) * 70).toFixed(0)}px;animation-duration:${(1.8 + Math.random() * 1.2).toFixed(2)}s;animation-delay:${k * 0.08}s`;
      e.innerHTML = HEART_SVG;
      box.appendChild(e);
      window.setTimeout(() => e.remove(), 3400);
    }
  };
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => { if (!document.hidden) spawnHearts(1); }, 1500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  // Vào trang: bó hoa nở xong thì bung cánh hoa 1 lần
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => {
      const r = bqRef.current?.getBoundingClientRect();
      if (r && r.width && r.bottom > 0 && r.top < window.innerHeight) wdBurst(r.left + r.width / 2, r.top + r.height * 0.35, 40, 1.4);
    }, 1150);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  const onBouquet = () => {
    const r = bqRef.current?.getBoundingClientRect();
    if (r) wdBurst(r.left + r.width / 2, r.top + r.height * 0.35, 34, 1.35);
    setBubble(BQ_LINES[bubbleIdx.current++ % BQ_LINES.length]);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 2200);
  };

  return (
    <section ref={heroRef} className="wdh">
      <WomenDayBouquetDefs />
      <div className="wdh-bg" aria-hidden>
        <div className="wdh-glow wdh-g1" /><div className="wdh-glow wdh-g2" /><div className="wdh-glow wdh-g3" />
        <div className="wdh-pattern" />
        {Array.from({ length: 14 }).map((_, i) => (
          <i key={i} className="wdh-bk" style={{
            left: `${(i * 41 + 9) % 100}%`, width: 6 + ((i * 7) % 16), height: 6 + ((i * 7) % 16),
            animationDuration: `${7 + ((i * 3) % 8)}s`, animationDelay: `-${((i * 1.7) % 12).toFixed(1)}s`,
          }} />
        ))}
      </div>

      <div className="wdh-in">
        <div className="wdh-text">
          <div className="wdh-chip wdh-up">🌸 Mùa hoa 20/10 · Aptis Kỳ Tích</div>
          <h1 className="wdh-h1 font-heading wdh-up" style={{ animationDelay: ".08s" }}>
            Xin chào, <span className="wdh-name">{name}</span> 👋
          </h1>
          <p className="wdh-wish wdh-up" style={{ animationDelay: ".16s" }}>
            Chúc bạn một mùa 20/10 thật rực rỡ — <b>học đúng, ôn trúng</b>, thi là đỗ!
          </p>
          <div className="wdh-sub wdh-up" style={{ animationDelay: ".22s" }}>{sub}</div>
          <div className="wdh-actions wdh-up" style={{ animationDelay: ".3s" }}>{actions}</div>
        </div>

        <div ref={stageRef} className="wdh-stage" aria-hidden>
          <div ref={rigRef} className="wdh-rig">
            <div className="wdh-ly wdh-halo" style={{ transform: "translateZ(-160px)" }} />
            <div className="wdh-ly wdh-ring" style={{ transform: "translateZ(-140px)" }} />
            <div className="wdh-ly wdh-2010 font-heading wdh-drop" style={{ transform: "translateZ(-70px)" }}>
              {EXTRUDE.map((i) => (
                <div key={i} className="wdh-ex" style={{ transform: `translateZ(${-i * 2.2}px)`, color: i > 9 ? "#3A0715" : i > 5 ? "#5A0B22" : "#7E1233" }}>20/10</div>
              ))}
              <div className="wdh-face">20/10</div>
            </div>
            <div className="wdh-ly" style={{ left: 40, top: 70, transform: "translateZ(-30px)" }}><div className="wdh-spark" /></div>
            <div className="wdh-ly" style={{ right: 30, top: 40, transform: "translateZ(-20px)" }}><div className="wdh-spark" style={{ animationDelay: ".8s" }} /></div>
            <div className="wdh-ly" style={{ right: 70, bottom: 60, transform: "translateZ(20px)" }}><div className="wdh-spark" style={{ animationDelay: "1.4s" }} /></div>
            <div className="wdh-ly wdh-tt" style={{ transform: "translateZ(10px)" }} onClick={() => spawnHearts(7)}>
              <TichTich size={230} mood={CYCLE[mi]} enterLines={TT_LINES} />
            </div>
            <div ref={bqRef} className="wdh-ly wdh-bq wdh-bloom" style={{ transform: "translateZ(60px) rotate(20deg)" }} onClick={onBouquet}>
              <WomenDayBouquet />
            </div>
            <div className="wdh-ly wdh-tag" style={{ transform: "translateZ(95px)" }}>Tặng bạn 💐</div>
            <div className={`wdh-ly wdh-bubble${bubble ? " on" : ""}`} style={{ transform: "translateZ(80px)" }}>{bubble ?? BQ_LINES[0]}</div>
            <div ref={heartsRef} className="wdh-ly" style={{ left: 0, top: 0, transform: "translateZ(110px)" }} />
            <div className="wdh-ly" style={{ left: 30, top: 30, transform: "translateZ(140px)" }}><div className="wdh-fp" /></div>
            <div className="wdh-ly" style={{ right: 20, top: 120, transform: "translateZ(170px)" }}><div className="wdh-fp" style={{ animationDelay: "1.2s", width: 12, height: 12 }} /></div>
            <div className="wdh-ly" style={{ left: 120, bottom: 20, transform: "translateZ(150px)" }}><div className="wdh-fp" style={{ animationDelay: "2.1s", width: 11, height: 11 }} /></div>
          </div>
        </div>
      </div>

      <div className="wdh-stats">{stats}</div>
    </section>
  );
}
