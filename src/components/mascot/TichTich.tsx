/**
 * Tích Tích — linh vật Aptis Kỳ Tích.
 * - Mắt nhìn theo chuột, đầu nghiêng, tự chớp mắt, ẩn trên thiết bị cảm ứng.
 * - 12 biểu cảm + che mắt (shy).
 * - Tương tác: di chuột vào (vẫy tay), giữ 1.5s (mắt tim), bấm (phản ứng ngẫu nhiên),
 *   bấm 5 lần (hờn dỗi), lắc chuột nhanh (chóng mặt), rời chuột (buồn), idle 12s (ngủ).
 * Không phụ thuộc thư viện ngoài. CSS được inject 1 lần vào <head>.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type TichTichMood =
  | "normal" | "happy" | "laugh" | "love" | "star" | "wink"
  | "surprise" | "think" | "worry" | "sad" | "angry" | "sleep";

type TempMood = TichTichMood | "spin";

export interface TichTichProps {
  /** Chiều rộng robot (px). Mặc định 120. */
  size?: number;
  /** Biểu cảm nền. Tương tác xong sẽ quay về biểu cảm này. */
  mood?: TichTichMood;
  /** Che mắt (ô mật khẩu). */
  shy?: boolean;
  /** Bật tương tác chuột. Mặc định true. */
  interactive?: boolean;
  /** Ngủ sau 12s không động chuột. */
  idleSleep?: boolean;
  /** Điểm nhìn ưu tiên (toạ độ viewport), vd con trỏ gõ trong ô email. */
  lookAt?: { x: number; y: number } | null;
  /** Vị trí bong bóng lời thoại: trên đầu (mặc định) hoặc bên trái robot. */
  bubbleSide?: "top" | "left";
  /** Câu nói khi di chuột vào (thay cho câu chào mặc định). */
  enterLines?: string[];
  className?: string;
}

const CSS = `
.tt-robot{--s:120px;width:var(--s);height:calc(var(--s)*1.12);position:relative;flex-shrink:0;user-select:none}
.tt-robot svg{width:100%;height:100%;overflow:visible}
.tt-robot .tt-head{transition:transform .25s ease-out;transform-origin:60px 70px}
.tt-robot .tt-pupil{transition:transform .08s linear}
.tt-robot .tt-lid{transform-origin:center;transform:scaleY(0);transition:transform .09s ease-in}
.tt-robot.tt-is-blink .tt-lid{transform:scaleY(1)}
.tt-robot .tt-hand{transition:transform .35s cubic-bezier(.3,1.4,.5,1);transform-box:fill-box;transform-origin:center}
.tt-robot.tt-is-shy .tt-hand-l{transform:translate(17px,-51px) rotate(12deg)}
.tt-robot.tt-is-shy .tt-hand-r{transform:translate(-17px,-51px) rotate(-12deg)}
.tt-robot .tt-antenna-dot{animation:tt-pulse 2.2s ease-in-out infinite}
@keyframes tt-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.tt-robot .tt-float{animation:tt-bob 3.2s ease-in-out infinite}
@keyframes tt-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
/* biểu cảm */
.tt-robot .tt-x,.tt-robot .tt-m{display:none}
.tt-robot .tt-m-smile{display:inline}
.tt-robot .tt-bow{transform-box:fill-box;transform-origin:center;animation:tt-bowwig 4s ease-in-out infinite}
@keyframes tt-bowwig{0%,88%,100%{transform:rotate(0)}92%{transform:rotate(-12deg)}96%{transform:rotate(10deg)}}
.tt-robot.tt-is-happy .tt-eyes-normal,.tt-robot.tt-is-laugh .tt-eyes-normal,.tt-robot.tt-is-love .tt-eyes-normal,.tt-robot.tt-is-star .tt-eyes-normal,.tt-robot.tt-is-sleep .tt-eyes-normal{display:none}
.tt-robot.tt-is-wink .tt-eye-r{display:none}
.tt-robot.tt-is-happy .tt-x-happy,.tt-robot.tt-is-happy .tt-m-big{display:inline}
.tt-robot.tt-is-laugh .tt-x-laugh,.tt-robot.tt-is-laugh .tt-m-laugh{display:inline}
.tt-robot.tt-is-love .tt-x-love,.tt-robot.tt-is-love .tt-m-big{display:inline}
.tt-robot.tt-is-star .tt-x-star,.tt-robot.tt-is-star .tt-m-o{display:inline}
.tt-robot.tt-is-wink .tt-x-wink,.tt-robot.tt-is-wink .tt-m-tongue{display:inline}
.tt-robot.tt-is-sleep .tt-x-sleep,.tt-robot.tt-is-sleep .tt-m-sleep{display:inline}
.tt-robot.tt-is-worry .tt-x-worry,.tt-robot.tt-is-worry .tt-m-worry{display:inline}
.tt-robot.tt-is-surprise .tt-x-surprise,.tt-robot.tt-is-surprise .tt-m-o{display:inline}
.tt-robot.tt-is-sad .tt-x-sad,.tt-robot.tt-is-sad .tt-m-sad{display:inline}
.tt-robot.tt-is-angry .tt-x-angry,.tt-robot.tt-is-angry .tt-m-pout{display:inline}
.tt-robot.tt-is-think .tt-x-think,.tt-robot.tt-is-think .tt-m-flat{display:inline}
.tt-robot.tt-is-happy .tt-m-smile,.tt-robot.tt-is-laugh .tt-m-smile,.tt-robot.tt-is-love .tt-m-smile,.tt-robot.tt-is-star .tt-m-smile,.tt-robot.tt-is-wink .tt-m-smile,.tt-robot.tt-is-sleep .tt-m-smile,.tt-robot.tt-is-worry .tt-m-smile,.tt-robot.tt-is-surprise .tt-m-smile,.tt-robot.tt-is-sad .tt-m-smile,.tt-robot.tt-is-angry .tt-m-smile,.tt-robot.tt-is-think .tt-m-smile{display:none}
.tt-robot.tt-is-happy .tt-cheek,.tt-robot.tt-is-laugh .tt-cheek,.tt-robot.tt-is-love .tt-cheek,.tt-robot.tt-is-shy .tt-cheek{opacity:.95}
.tt-robot.tt-is-angry .tt-cheek{opacity:1;fill:#FF5A4A;transform:scale(1.4);transform-box:fill-box;transform-origin:center}
.tt-robot.tt-is-surprise .tt-pupil{transform:scale(1.2)!important;transform-box:fill-box;transform-origin:center}
.tt-robot.tt-is-think .tt-pupil{transform:translate(3px,-4px)!important}
.tt-robot.tt-is-sad .tt-pupil{transform:translate(0,3px) scale(.9)!important;transform-box:fill-box;transform-origin:center}
.tt-robot.tt-is-worry .tt-pupil{transform:scale(.8)!important;transform-box:fill-box;transform-origin:center}
.tt-robot.tt-is-happy .tt-float,.tt-robot.tt-is-laugh .tt-float{animation:tt-hop .9s ease-in-out infinite}
@keyframes tt-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}60%{transform:translateY(-7px)}}
.tt-robot.tt-is-laugh .tt-head{animation:tt-shake .35s ease-in-out infinite}
@keyframes tt-shake{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.tt-robot .tt-heart{transform-box:fill-box;transform-origin:center;animation:tt-beat .8s ease-in-out infinite}
@keyframes tt-beat{0%,100%{transform:scale(1)}30%{transform:scale(1.25)}}
.tt-robot .tt-star{transform-box:fill-box;transform-origin:center;animation:tt-twinkle 1.6s linear infinite}
@keyframes tt-twinkle{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(20deg) scale(1.15)}}
.tt-robot .tt-spark{animation:tt-blinkspark 1.2s ease-in-out infinite}
@keyframes tt-blinkspark{0%,100%{opacity:1}50%{opacity:.2}}
.tt-robot .tt-tear{animation:tt-drop 1.6s ease-in infinite}
@keyframes tt-drop{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(14px);opacity:0}}
.tt-robot .tt-sweat{animation:tt-drop 2.2s ease-in infinite}
.tt-robot .tt-zzz{animation:tt-zzz 2.4s ease-in-out infinite}
@keyframes tt-zzz{0%{transform:translate(0,4px);opacity:0}40%{opacity:1}100%{transform:translate(6px,-8px);opacity:0}}
.tt-robot.tt-is-sleep .tt-head{transform:rotate(8deg)!important}
.tt-robot.tt-is-angry .tt-float{animation:tt-tremble .18s linear infinite}
@keyframes tt-tremble{0%,100%{transform:translateX(0)}50%{transform:translateX(1.2px)}}
.tt-robot.tt-is-surprise .tt-float{animation:tt-jump 1.4s ease-out infinite}
@keyframes tt-jump{0%,60%,100%{transform:translateY(0)}20%{transform:translateY(-12px)}}
.tt-robot .tt-qmark{animation:tt-bob 1.8s ease-in-out infinite}
.tt-robot.tt-is-love .tt-hand-r,.tt-robot.tt-is-star .tt-hand-r{transform:translate(4px,-14px) rotate(-30deg)}
.tt-robot.tt-is-star .tt-hand-l{transform:translate(-4px,-14px) rotate(30deg)}
.tt-robot.tt-is-think .tt-hand-r{transform:translate(-14px,-22px) rotate(-20deg)}
.tt-robot.tt-is-interactive{cursor:pointer}
.tt-bubble{position:absolute;left:50%;bottom:100%;transform:translate(-50%,6px) scale(.9);background:#fff;border:1px solid #f0d4cd;border-radius:12px;padding:5px 10px;font-size:12px;font-weight:600;white-space:nowrap;color:#3b1a14;box-shadow:0 6px 16px #0000001a;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:5}
.tt-bubble::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff}
.tt-bubble.tt-show{opacity:1;transform:translate(-50%,-2px) scale(1)}
.tt-robot.tt-is-wave .tt-hand-r{animation:tt-wave .45s ease-in-out 4}
@keyframes tt-wave{0%,100%{transform:translate(4px,-16px) rotate(-40deg)}50%{transform:translate(4px,-18px) rotate(-10deg)}}
.tt-robot.tt-is-spin .tt-float{animation:tt-spinjump .7s ease-in-out 1}
@keyframes tt-spinjump{0%{transform:translateY(0) rotate(0)}40%{transform:translateY(-16px) rotate(180deg)}100%{transform:translateY(0) rotate(360deg)}}
.tt-robot.tt-is-squish .tt-float{animation:tt-squish .35s ease-out 1}
@keyframes tt-squish{0%{transform:scale(1,1)}40%{transform:scale(1.12,.86) translateY(8px)}100%{transform:scale(1,1)}}
.tt-robot.tt-is-dizzy .tt-eyes-normal .tt-pupil{animation:tt-dizzy .5s linear infinite}
@keyframes tt-dizzy{0%{transform:translate(3px,0)}25%{transform:translate(0,3px)}50%{transform:translate(-3px,0)}75%{transform:translate(0,-3px)}100%{transform:translate(3px,0)}}
.tt-robot.tt-is-dizzy .tt-head{animation:tt-shake .25s ease-in-out infinite}
.tt-bubble.tt-left{left:auto;right:100%;bottom:auto;top:18%;transform:translate(4px,0) scale(.9);white-space:normal;width:max-content;max-width:230px;line-height:1.35;text-align:left}
.tt-bubble.tt-left.tt-show{transform:translate(-8px,0) scale(1)}
.tt-bubble.tt-left::after{left:100%;top:50%;transform:translateY(-50%);border-top-color:transparent;border-left-color:#fff}
@media (hover:none),(pointer:coarse){.tt-robot{display:none!important}}
`;

let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  const existing = document.getElementById("tichtich-css");
  // Luôn ghi đè CSS mới (tránh bản cũ còn sót sau khi cập nhật / hot reload).
  if (existing) { existing.textContent = CSS; cssInjected = true; return; }
  const el = document.createElement("style");
  el.id = "tichtich-css";
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

const LINES = {
  enter: ["Chào bạn! 👋", "Hôm nay luyện gì nè?", "Hi hi 😄"],
  love: ["Được xoa đầu thích quá 💕", "Hehe nhột 🥰"],
  click: [
    ["laugh", "Hahaha 😆"],
    ["star", "Luyện đề Key chưa? ✨"],
    ["wink", "Mẹo: đọc câu hỏi trước nha 😉"],
    ["surprise", "Ơ! Giật cả mình 😲"],
    ["spin", "Wheee! 🌀"],
  ] as [TempMood, string][],
  angry: "Đừng chọc nữa mà 😤",
  dizzy: "Chóng mặt quá 😵‍💫",
  leave: "Ơ đi đâu thế 🥺",
  sleep: "Zzz… 😴",
  wake: "Ơ mình tỉnh rồi! 😳",
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function TichTich({
  size = 120,
  mood = "normal",
  shy = false,
  interactive = true,
  idleSleep = false,
  lookAt = null,
  bubbleSide = "top",
  enterLines,
  className = "",
}: TichTichProps) {
  const rawId = useId();
  const uid = useMemo(() => "tt" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lookRef = useRef(lookAt);
  lookRef.current = lookAt;

  const [temp, setTemp] = useState<TempMood | null>(null);
  const [fx, setFx] = useState({ wave: false, spin: false, squish: false, dizzy: false });
  const [blink, setBlink] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; show: boolean }>({ text: "", show: false });

  const tempTimer = useRef<number>();
  const bubbleTimer = useRef<number>();
  const hoverTimer = useRef<number>();
  const clicks = useRef<number[]>([]);
  const flips = useRef<number[]>([]);
  const lastX = useRef<number | null>(null);
  const lastDir = useRef(0);
  const enteredAt = useRef(0);

  useEffect(() => { injectCss(); }, []);

  // ---- nhìn theo chuột ----
  useEffect(() => {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, raf = 0;
    const update = () => {
      raf = 0;
      const root = rootRef.current, svg = svgRef.current;
      if (!root || !svg) return;
      const box = root.getBoundingClientRect();
      if (!box.width) return;
      const t = lookRef.current;
      const tx = t ? t.x : mx, ty = t ? t.y : my;
      const k = box.width / 120;
      const head = svg.querySelector<SVGGElement>(".tt-head");
      if (head) {
        const dx = tx - (box.left + 60 * k), dy = ty - (box.top + 60 * k);
        const tilt = Math.max(-10, Math.min(10, dx / 40));
        const lift = Math.max(-3, Math.min(3, dy / 120));
        head.style.transform = `rotate(${tilt * 0.6}deg) translate(${tilt * 0.25}px, ${lift}px)`;
      }
      svg.querySelectorAll<SVGGElement>(".tt-eye").forEach((eye) => {
        const cx = box.left + Number(eye.dataset.cx) * k, cy = box.top + Number(eye.dataset.cy) * k;
        const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(4.5, d / 25);
        const p = eye.querySelector<SVGGElement>(".tt-pupil");
        if (p) p.style.transform = `translate(${(dx / d) * reach}px, ${(dy / d) * reach}px)`;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; schedule(); };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // lookAt thay đổi → cập nhật ngay
  useEffect(() => {
    if (lookAt) window.dispatchEvent(new MouseEvent("mousemove", { clientX: lookAt.x, clientY: lookAt.y }));
  }, [lookAt?.x, lookAt?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- chớp mắt ----
  useEffect(() => {
    let t1: number, t2: number;
    const loop = () => {
      setBlink(true);
      t2 = window.setTimeout(() => setBlink(false), 130);
      t1 = window.setTimeout(loop, 3000 + Math.random() * 2500);
    };
    t1 = window.setTimeout(loop, 1000 + Math.random() * 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const say = useCallback((text: string, ms = 1800) => {
    setBubble({ text, show: true });
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble((b) => ({ ...b, show: false })), ms);
  }, []);

  const react = useCallback((m: TempMood | null, ms: number, text?: string) => {
    if (shy) return;
    clearTimeout(tempTimer.current);
    if (m === "spin") {
      setTemp("happy");
      setFx((f) => ({ ...f, spin: true }));
      window.setTimeout(() => setFx((f) => ({ ...f, spin: false })), 720);
    } else {
      setTemp(m);
    }
    if (text) say(text, Math.min(ms, 2600));
    tempTimer.current = window.setTimeout(() => {
      setTemp(null);
      setFx((f) => ({ ...f, dizzy: false }));
    }, ms);
  }, [shy, say]);

  // ---- ngủ khi idle ----
  useEffect(() => {
    if (!idleSleep) return;
    let t: number;
    let asleep = false;
    const arm = () => {
      clearTimeout(t);
      t = window.setTimeout(() => { asleep = true; setSleeping(true); say(LINES.sleep, 3000); }, 12000);
    };
    const onMove = () => {
      if (asleep) { asleep = false; setSleeping(false); react("surprise", 1100, LINES.wake); }
      arm();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    arm();
    return () => { clearTimeout(t); window.removeEventListener("mousemove", onMove); };
  }, [idleSleep, react, say]);

  useEffect(() => () => {
    clearTimeout(tempTimer.current); clearTimeout(bubbleTimer.current); clearTimeout(hoverTimer.current);
  }, []);

  // ---- handlers ----
  const onEnter = () => {
    if (!interactive) return;
    enteredAt.current = Date.now();
    react("happy", 2600, pick(enterLines && enterLines.length ? enterLines : LINES.enter));
    setFx((f) => ({ ...f, wave: true }));
    window.setTimeout(() => setFx((f) => ({ ...f, wave: false })), 1900);
    clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => react("love", 2600, pick(LINES.love)), 1500);
  };
  const onMoveSelf = (e: React.MouseEvent) => {
    if (!interactive) return;
    if (lastX.current !== null) {
      const d = Math.sign(e.clientX - lastX.current);
      if (d && d !== lastDir.current) { flips.current.push(Date.now()); lastDir.current = d; }
    }
    lastX.current = e.clientX;
    const now = Date.now();
    flips.current = flips.current.filter((t) => now - t < 700);
    if (flips.current.length >= 6) {
      flips.current = [];
      clearTimeout(hoverTimer.current);
      setFx((f) => ({ ...f, dizzy: true }));
      react(null, 1800, LINES.dizzy);
    }
  };
  const onLeave = () => {
    if (!interactive) return;
    clearTimeout(hoverTimer.current);
    lastX.current = null;
    if (Date.now() - enteredAt.current > 1200) react("sad", 1300, LINES.leave);
  };
  const onClick = () => {
    if (!interactive) return;
    clearTimeout(hoverTimer.current);
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < 2000);
    clicks.current.push(now);
    setFx((f) => ({ ...f, squish: false }));
    requestAnimationFrame(() => setFx((f) => ({ ...f, squish: true })));
    window.setTimeout(() => setFx((f) => ({ ...f, squish: false })), 380);
    if (clicks.current.length >= 5) { clicks.current = []; react("angry", 2400, LINES.angry); return; }
    const [m, t] = pick(LINES.click);
    react(m, 2000, t);
  };

  const effective = shy ? null : (temp ?? (sleeping ? "sleep" : mood));
  const cls = [
    "tt-robot",
    effective && effective !== "normal" && effective !== "spin" ? `tt-is-${effective}` : "",
    shy ? "tt-is-shy" : "",
    blink ? "tt-is-blink" : "",
    interactive ? "tt-is-interactive" : "",
    fx.wave ? "tt-is-wave" : "",
    fx.spin ? "tt-is-spin" : "",
    fx.squish ? "tt-is-squish" : "",
    fx.dizzy ? "tt-is-dizzy" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={cls}
      style={{ ["--s" as any]: `${size}px` }}
      onMouseEnter={onEnter}
      onMouseMove={onMoveSelf}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="img"
      aria-label="Tích Tích — linh vật Aptis Kỳ Tích"
    >
        <svg ref={svgRef} viewBox="0 0 120 134" aria-hidden="true">
        <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FEAD5F"/><stop offset="1" stopColor="#CC1C01"/>
        </linearGradient>
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#F3EDF2"/>
        </linearGradient>
        </defs>
        <g className="tt-float">
        {/* thân */}
        <ellipse cx="60" cy="129" rx="30" ry="4" fill="#0000001a"/>
        <rect x="34" y="94" width="52" height="30" rx="14" fill={`url(#${uid}-body)`}/>
        <rect x="50" y="102" width="20" height="12" rx="4" fill="#fff" opacity=".9"/>
        <text x="60" y="111.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#CC1C01" fontFamily="Arial">A</text>
        {/* đầu */}
        <g className="tt-head">
        <line x1="60" y1="14" x2="60" y2="26" stroke="#CC1C01" strokeWidth="3" strokeLinecap="round"/>
        <circle className="tt-antenna-dot" cx="60" cy="11" r="5" fill="#FEAD5F"/>
        <rect x="16" y="24" width="88" height="70" rx="30" fill={`url(#${uid}-body)`}/>
        <rect x="8" y="50" width="10" height="20" rx="5" fill="#CC1C01"/>
        <rect x="102" y="50" width="10" height="20" rx="5" fill="#CC1C01"/>
        <rect x="26" y="36" width="68" height="46" rx="22" fill={`url(#${uid}-face)`}/>
        {/* nơ */}
        <g className="tt-bow">
        <path d="M84 30 C74 20 70 34 80 36 Z" fill="#FF5C8A"/>
        <path d="M88 30 C98 20 102 34 92 36 Z" fill="#FF5C8A"/>
        <path d="M84 30 C78 24 75 31 80 34" fill="#FF8FB1"/>
        <path d="M88 30 C94 24 97 31 92 34" fill="#FF8FB1"/>
        <circle cx="86" cy="32" r="3.6" fill="#E23D6E"/>
        </g>
        {/* mắt thường */}
        <g className="tt-eyes-normal">
        <g className="tt-eye tt-eye-l" data-cx="46" data-cy="58">
        <g className="tt-pupil"><ellipse cx="46" cy="58" rx="7.5" ry="9" fill="#24085a"/><circle cx="48.5" cy="54.5" r="2.4" fill="#fff"/><circle cx="44" cy="61" r="1.1" fill="#fff" opacity=".8"/></g>
        <rect className="tt-lid" x="36" y="47" width="20" height="22" rx="10" fill="#FBF8FA" style={{ transformBox: "fill-box" }}/>
        <path className="tt-lash" d="M39.5 50.5 L35 47.5 M42 48.3 L39.5 43.8" stroke="#24085a" strokeWidth="2" strokeLinecap="round"/>
        </g>
        <g className="tt-eye tt-eye-r" data-cx="74" data-cy="58">
        <g className="tt-pupil"><ellipse cx="74" cy="58" rx="7.5" ry="9" fill="#24085a"/><circle cx="76.5" cy="54.5" r="2.4" fill="#fff"/><circle cx="72" cy="61" r="1.1" fill="#fff" opacity=".8"/></g>
        <rect className="tt-lid" x="64" y="47" width="20" height="22" rx="10" fill="#FBF8FA" style={{ transformBox: "fill-box" }}/>
        <path className="tt-lash" d="M80.5 50.5 L85 47.5 M78 48.3 L80.5 43.8" stroke="#24085a" strokeWidth="2" strokeLinecap="round"/>
        </g>
        </g>
        <g className="tt-x tt-x-happy">
        <path d="M38 61 Q46 50 54 61" stroke="#24085a" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        <path d="M66 61 Q74 50 82 61" stroke="#24085a" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        <path d="M38.5 60 L34.5 58 M81.5 60 L85.5 58" stroke="#24085a" strokeWidth="2" strokeLinecap="round"/>
        </g>
        <g className="tt-x tt-x-laugh">
        <path d="M39 52 L51 57 L39 62" stroke="#24085a" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M81 52 L69 57 L81 62" stroke="#24085a" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <g className="tt-x tt-x-love">
        <path className="tt-heart" d="M46 66 C36 58 38 49 46 53 C54 49 56 58 46 66 Z" fill="#FF3D6E"/>
        <path className="tt-heart" d="M74 66 C64 58 66 49 74 53 C82 49 84 58 74 66 Z" fill="#FF3D6E"/>
        </g>
        <g className="tt-x tt-x-star">
        <path className="tt-star" d="M46 48 L48.6 55.2 L56 55.6 L50.2 60 L52.2 67 L46 62.8 L39.8 67 L41.8 60 L36 55.6 L43.4 55.2 Z" fill="#FFB020" stroke="#CC1C01" strokeWidth="1"/>
        <path className="tt-star" d="M74 48 L76.6 55.2 L84 55.6 L78.2 60 L80.2 67 L74 62.8 L67.8 67 L69.8 60 L64 55.6 L71.4 55.2 Z" fill="#FFB020" stroke="#CC1C01" strokeWidth="1"/>
        <g className="tt-spark"><path d="M10 30 L12 35 L17 37 L12 39 L10 44 L8 39 L3 37 L8 35 Z" fill="#FFB020"/><path d="M108 40 L109.4 43.6 L113 45 L109.4 46.4 L108 50 L106.6 46.4 L103 45 L106.6 43.6 Z" fill="#FEAD5F"/></g>
        </g>
        <g className="tt-x tt-x-wink">
        <path d="M66 59 Q74 52 82 59" stroke="#24085a" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        <path d="M83 58 L86 55.5" stroke="#24085a" strokeWidth="2" strokeLinecap="round"/>
        </g>
        <g className="tt-x tt-x-sleep">
        <path d="M38 60 Q46 65 54 60" stroke="#24085a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M66 60 Q74 65 82 60" stroke="#24085a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <g className="tt-zzz"><text x="100" y="32" fontSize="12" fontWeight="800" fill="#24085a" fontFamily="Arial">Z</text><text x="109" y="22" fontSize="8" fontWeight="800" fill="#24085a" fontFamily="Arial" opacity=".7">z</text></g>
        </g>
        <g className="tt-x tt-x-worry">
        <path d="M37 47 L52 43" stroke="#24085a" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M83 47 L68 43" stroke="#24085a" strokeWidth="2.6" strokeLinecap="round"/>
        <path className="tt-sweat" d="M98 38 C94 44 95 48 98 48 C101 48 102 44 98 38 Z" fill="#6EC6FF"/>
        </g>
        <g className="tt-x tt-x-surprise">
        <path d="M39 43 Q46 37 53 43" stroke="#24085a" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        <path d="M67 43 Q74 37 81 43" stroke="#24085a" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        <path d="M6 22 L11 28 M114 22 L109 28" stroke="#CC1C01" strokeWidth="2.2" strokeLinecap="round"/>
        </g>
        <g className="tt-x tt-x-sad">
        <path d="M38 45 L52 49" stroke="#24085a" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M82 45 L68 49" stroke="#24085a" strokeWidth="2.6" strokeLinecap="round"/>
        <path className="tt-tear" d="M40 66 C37 71 38 74 40.5 74 C43 74 44 71 40 66 Z" fill="#6EC6FF"/>
        </g>
        <g className="tt-x tt-x-angry">
        <path d="M37 44 L52 49" stroke="#24085a" strokeWidth="3" strokeLinecap="round"/>
        <path d="M83 44 L68 49" stroke="#24085a" strokeWidth="3" strokeLinecap="round"/>
        <path d="M101 26 l6 6 M107 26 l-6 6" stroke="#CC1C01" strokeWidth="2.4" strokeLinecap="round"/>
        </g>
        <g className="tt-x tt-x-think">
        <path d="M39 46 L52 46" stroke="#24085a" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M67 44 Q74 38 81 42" stroke="#24085a" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        <text className="tt-qmark" x="102" y="26" fontSize="16" fontWeight="900" fill="#CC1C01" fontFamily="Arial">?</text>
        </g>
        <circle className="tt-cheek" cx="35" cy="72" r="4.5" fill="#FF8A6B" opacity=".45"/>
        <circle className="tt-cheek" cx="85" cy="72" r="4.5" fill="#FF8A6B" opacity=".45"/>
        <path className="tt-m tt-m-smile" d="M53 73 Q60 79 67 73" stroke="#CC1C01" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        <g className="tt-m tt-m-big"><path d="M50 70 Q60 85 70 70 Z" fill="#CC1C01"/><path d="M55 77 Q60 82 65 77 Q60 74 55 77 Z" fill="#FF8FA3"/></g>
        <g className="tt-m tt-m-laugh"><path d="M48 68 Q60 88 72 68 Z" fill="#CC1C01"/><path d="M54 78 Q60 84 66 78 Q60 74 54 78 Z" fill="#FF8FA3"/></g>
        <path className="tt-m tt-m-worry" d="M53 77 Q60 72 67 77" stroke="#CC1C01" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        <path className="tt-m tt-m-sad" d="M52 79 Q60 70 68 79" stroke="#CC1C01" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        <ellipse className="tt-m tt-m-o" cx="60" cy="75" rx="4.5" ry="6" fill="#CC1C01"/>
        <path className="tt-m tt-m-pout" d="M54 76 Q57 73 60 76 Q63 79 66 76" stroke="#CC1C01" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        <g className="tt-m tt-m-tongue"><path d="M52 72 Q60 80 68 72" stroke="#CC1C01" strokeWidth="2.6" fill="none" strokeLinecap="round"/><path d="M58 76 Q58 83 62 83 Q65 83 64 76 Z" fill="#FF6F8F"/></g>
        <path className="tt-m tt-m-flat" d="M55 76 Q60 74 66 77" stroke="#CC1C01" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
        <ellipse className="tt-m tt-m-sleep" cx="60" cy="76" rx="2.6" ry="3" fill="#CC1C01"/>
        </g>
        {/* tay */}
        <g className="tt-hand tt-hand-l"><rect x="22" y="98" width="14" height="22" rx="7" fill={`url(#${uid}-body)`}/></g>
        <g className="tt-hand tt-hand-r"><rect x="84" y="98" width="14" height="22" rx="7" fill={`url(#${uid}-body)`}/></g>
        </g>
        </svg>
      <div className={`tt-bubble ${bubbleSide === "left" ? "tt-left" : ""} ${bubble.show ? "tt-show" : ""}`}>{bubble.text}</div>
    </div>
  );
}
