/**
 * Bó hoa 20/10 — cùng style Tích Tích (gradient chéo mềm, không viền, highlight bóng).
 * 4 lớp lệch chiều sâu (translateZ) để xoay 3D trong hero. Nội dung SVG tĩnh, tự sinh.
 */
const GR: Record<string, [string, string]> = {
  red: ["#FF8A7A", "#CC1C01"], redIn: ["#E8344A", "#7E0A12"],
  pink: ["#FFD0DC", "#E8476F"], pinkIn: ["#FF8FB0", "#B81E4A"],
  peach: ["#FFD9A8", "#F26A2E"], peachIn: ["#FEAD5F", "#CC1C01"],
  leaf: ["#A6E59A", "#2F8A44"], leaf2: ["#C6F0B4", "#4FA85A"],
  wrap: ["#FFF8F3", "#FFD3DE"], wrap2: ["#FFE3EA", "#FF9DB6"],
  rib: ["#FEAD5F", "#CC1C01"], cream: ["#FFFFFF", "#FFE1EA"],
};
const F = (k: string) => `url(#wdb-${k})`;
const n = (v: number) => +v.toFixed(2);

const DEFS =
  Object.entries(GR)
    .map(([k, [a, b]]) => `<linearGradient id="wdb-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`)
    .join("") +
  `<radialGradient id="wdb-shade" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5A0018" stop-opacity=".28"/></radialGradient>`;

function rose(x: number, y: number, r: number, o: string, i: string, rot = 0) {
  let s = `<g transform="translate(${x} ${y}) rotate(${rot})">`;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 6.283 + 0.3;
    s += `<circle cx="${n(Math.cos(a) * r * 0.5)}" cy="${n(Math.sin(a) * r * 0.5)}" r="${n(r * 0.5)}" fill="${F(o)}"/>`;
  }
  s += `<circle r="${n(r * 0.98)}" fill="url(#wdb-shade)"/>`;
  s += `<circle cy="${n(r * 0.03)}" r="${n(r * 0.56)}" fill="${F(i)}"/>`;
  s += `<path d="M${n(-r * 0.42)} ${n(-r * 0.2)} Q${n(-r * 0.05)} ${n(-r * 0.62)} ${n(r * 0.38)} ${n(-r * 0.22)} Q${n(r * 0.02)} ${n(-r * 0.34)} ${n(-r * 0.42)} ${n(-r * 0.2)}Z" fill="${F(o)}"/>`;
  s += `<circle cx="${n(r * 0.03)}" cy="${n(-r * 0.04)}" r="${n(r * 0.2)}" fill="${F(i)}"/>`;
  s += `<path d="M${n(-r * 0.62)} ${n(r * 0.02)} Q0 ${n(r * 0.82)} ${n(r * 0.62)} ${n(r * 0.02)} Q0 ${n(r * 0.42)} ${n(-r * 0.62)} ${n(r * 0.02)}Z" fill="${F(o)}"/>`;
  s += `<ellipse cx="${n(-r * 0.42)}" cy="${n(-r * 0.5)}" rx="${n(r * 0.24)}" ry="${n(r * 0.11)}" fill="#fff" opacity=".6" transform="rotate(-35 ${n(-r * 0.42)} ${n(-r * 0.5)})"/>`;
  s += `<ellipse cx="${n(-r * 0.12)}" cy="${n(r * 0.42)}" rx="${n(r * 0.18)}" ry="${n(r * 0.06)}" fill="#fff" opacity=".35"/>`;
  return s + `</g>`;
}
function blossom(x: number, y: number, r: number, rot = 0) {
  let s = `<g transform="translate(${x} ${y}) rotate(${rot})">`;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 6.283 - 1.57, cx = n(Math.cos(a) * r * 0.52), cy = n(Math.sin(a) * r * 0.52);
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${n(r * 0.5)}" ry="${n(r * 0.42)}" fill="${F("cream")}" transform="rotate(${n(a * 57.3 + 90)} ${cx} ${cy})"/>`;
  }
  s += `<circle r="${n(r * 0.3)}" fill="${F("peach")}"/><circle cx="${n(-r * 0.08)}" cy="${n(-r * 0.1)}" r="${n(r * 0.1)}" fill="#fff" opacity=".7"/>`;
  return s + `</g>`;
}
function leaf(x: number, y: number, l: number, rot: number, g = "leaf") {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 C${n(l * 0.45)} ${n(-l * 0.25)} ${n(l * 0.4)} ${n(-l * 0.8)} 0 ${-l} C${n(-l * 0.4)} ${n(-l * 0.8)} ${n(-l * 0.45)} ${n(-l * 0.25)} 0 0Z" fill="${F(g)}"/><path d="M0 ${n(-l * 0.1)} Q${n(l * 0.06)} ${n(-l * 0.5)} 0 ${n(-l * 0.85)}" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
}
function dots(x: number, y: number, c: number) {
  let s = "";
  for (let k = 0; k < c; k++) {
    const a = k * 2.4, d = 4 + k * 1.6;
    s += `<circle cx="${n(x + Math.cos(a) * d)}" cy="${n(y + Math.sin(a) * d)}" r="${n(3.2 - k * 0.25)}" fill="${F("cream")}"/>`;
  }
  return s;
}

const V = 'viewBox="-100 -120 200 240"';
const LAYERS: { z: number; svg: string }[] = [
  { z: -18, svg: `<svg ${V}>${leaf(-34, 10, 74, -42)}${leaf(36, 6, 76, 40, "leaf2")}${leaf(-8, 0, 70, -12, "leaf2")}${leaf(14, 4, 66, 16)}${dots(-66, -48, 6)}${dots(64, -60, 6)}${dots(4, -104, 5)}</svg>` },
  { z: 0, svg: `<svg ${V}>${blossom(-58, -66, 20, 10)}${blossom(60, -74, 18, -14)}${rose(-4, -88, 27, "peach", "peachIn", 15)}${rose(-40, -66, 22, "pink", "pinkIn", -20)}${rose(38, -76, 21, "peach", "peachIn", 30)}</svg>` },
  { z: 20, svg: `<svg ${V}>${rose(-32, -34, 33, "red", "redIn", -12)}${rose(32, -42, 31, "pink", "pinkIn", 22)}${rose(0, -6, 30, "red", "redIn", 4)}${blossom(-64, -4, 14, 20)}${blossom(62, -8, 13, -10)}</svg>` },
  {
    z: 38,
    svg: `<svg ${V}>
    <path d="M-76 0 Q-38 22 0 14 Q38 22 76 0 L10 98 Q0 106 -10 98Z" fill="${F("wrap2")}"/>
    <path d="M-62 12 Q-30 32 0 26 Q30 32 62 12 L8 98 Q0 104 -8 98Z" fill="${F("wrap")}"/>
    <path d="M0 26 Q30 32 62 12 L8 98 Q0 104 -2 100Z" fill="#E89AB0" opacity=".35"/>
    <ellipse cx="-34" cy="40" rx="16" ry="5" fill="#fff" opacity=".8" transform="rotate(-55 -34 40)"/>
    <g transform="translate(0 64)">
      <ellipse cx="-17" cy="-6" rx="17" ry="10" fill="${F("rib")}" transform="rotate(-22 -17 -6)"/>
      <ellipse cx="17" cy="-6" rx="17" ry="10" fill="${F("rib")}" transform="rotate(22 17 -6)"/>
      <ellipse cx="-17" cy="-6" rx="7" ry="4" fill="#7E0A12" opacity=".35" transform="rotate(-22 -17 -6)"/>
      <ellipse cx="17" cy="-6" rx="7" ry="4" fill="#7E0A12" opacity=".35" transform="rotate(22 17 -6)"/>
      <rect x="-15" y="0" width="9" height="30" rx="4.5" fill="${F("rib")}" transform="rotate(22 -10 0)"/>
      <rect x="6" y="0" width="9" height="30" rx="4.5" fill="${F("rib")}" transform="rotate(-22 10 0)"/>
      <circle r="8" fill="${F("rib")}"/><ellipse cx="-22" cy="-10" rx="6" ry="2.6" fill="#fff" opacity=".55" transform="rotate(-30 -22 -10)"/><circle cx="-2" cy="-3" r="2.4" fill="#fff" opacity=".6"/>
    </g></svg>`,
  },
];

/** Gradient dùng chung (bó hoa + tim bay). Render 1 lần trong hero. */
export const WomenDayBouquetDefs = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />
);

export default function WomenDayBouquet() {
  return (
    <div className="wdh-bq-sway">
      {LAYERS.map((l, i) => (
        <div key={i} className="wdh-bq-layer" style={{ transform: `translateZ(${l.z}px)` }} dangerouslySetInnerHTML={{ __html: l.svg }} />
      ))}
    </div>
  );
}
