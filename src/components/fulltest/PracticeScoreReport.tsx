import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSkillBand, toScaledScore } from "@/data/questions";
import logoAsset from "@/assets/aptis-kytich-logo.png.asset.json";

type SkillKey = "speaking" | "listening" | "grammar" | "reading" | "writing";
type Scores = Record<SkillKey, { correct: number; total: number }>;

interface Props {
  scores: Scores;
  sessionId: string;
}

export interface PracticeScoreReportHandle {
  download: () => Promise<void>;
}

const BAND_TO_NUM: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };
const NUM_TO_BAND = ["A0", "A1", "A2", "B1", "B2", "C"];
const BAND_LABEL: Record<string, string> = { A0: "A0", A1: "A1", A2: "A2", B1: "B1", B2: "B2", C: "C1" };
const Y_LEVELS = ["C1", "B2", "B1", "A2", "A1", "A0"]; // top → bottom

const BRAND_RED = "#CC1C01";
const BRAND_NAVY = "#002F5F";
const BRAND_BROWN = "#4D0D0D";

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

const refFromSession = (sid: string) => {
  const hex = sid.replace(/[^a-fA-F0-9]/g, "");
  return (hex.slice(0, 10) || sid.slice(-10)).toUpperCase();
};

const PracticeScoreReport = forwardRef<PracticeScoreReportHandle, Props>(({ scores, sessionId }, ref) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>("");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const name =
        (data as any)?.display_name?.trim() ||
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        (user.email ? user.email.split("@")[0] : "") ||
        "Học viên";
      setDisplayName(name);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const testDate = useMemo(() => formatDate(new Date()), []);
  const refNumber = useMemo(() => refFromSession(sessionId), [sessionId]);

  const skillHas = (sk: SkillKey) => scores[sk].total > 0;
  const score50 = (sk: SkillKey) => toScaledScore(scores[sk].correct, scores[sk].total);
  const bandOf = (sk: "listening" | "reading" | "speaking" | "writing") =>
    skillHas(sk) ? getSkillBand(score50(sk), sk) : null;

  const listening = skillHas("listening") ? score50("listening") : null;
  const reading = skillHas("reading") ? score50("reading") : null;
  const speaking = skillHas("speaking") ? score50("speaking") : null;
  const writing = skillHas("writing") ? score50("writing") : null;
  const grammar = skillHas("grammar") ? score50("grammar") : null;

  const bandListening = bandOf("listening");
  const bandReading = bandOf("reading");
  const bandSpeaking = bandOf("speaking");
  const bandWriting = bandOf("writing");

  const totalScore = [listening, reading, speaking, writing].every((v) => v !== null)
    ? (listening! + reading! + speaking! + writing!)
    : null;

  const skillBands = [bandListening, bandReading, bandSpeaking, bandWriting].filter(
    (b): b is string => !!b,
  );
  const overallBand = skillBands.length > 0
    ? NUM_TO_BAND[
        Math.max(0, Math.min(5, Math.round(
          skillBands.reduce((s, b) => s + (BAND_TO_NUM[b] ?? 0), 0) / skillBands.length
        )))
      ]
    : null;

  const showBand = (b: string | null) => (b ? BAND_LABEL[b] ?? b : "—");
  const heightForBand = (b: string | null) => {
    if (!b) return 0;
    const n = BAND_TO_NUM[b] ?? 0; // 0..5
    return ((n + 1) / 6) * 100; // percent of chart area, A0 shows small bar
  };

  const chartBars: Array<{ label: string; band: string | null; color: string }> = [
    { label: "Listening", band: bandListening, color: BRAND_RED },
    { label: "Reading", band: bandReading, color: BRAND_RED },
    { label: "Speaking", band: bandSpeaking, color: BRAND_RED },
    { label: "Writing", band: bandWriting, color: BRAND_RED },
    { label: "Overall\nCEFR grade", band: overallBand, color: BRAND_NAVY },
  ];

  // Load handwriting font once
  useEffect(() => {
    const id = "gf-great-vibes";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    try {
      // ensure fonts are ready so signature renders correctly in html2canvas
      if ((document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch {}
      }
      const canvas = await html2canvas(sheetRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `Aptis-KyTich-ScoreReport-${refNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.warn("[PracticeScoreReport] download failed", e);
    }
  };

  useImperativeHandle(ref, () => ({ download: handleDownload }), [refNumber]);

  return (
    <div className="w-full">
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative mx-auto max-w-3xl bg-white text-neutral-900 shadow-xl rounded-md overflow-hidden"
        style={{ padding: "40px 44px", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Watermark */}
        <img
          src={logoAsset.url}
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute left-1/2 top-1/2"
          style={{
            width: 460,
            height: 460,
            transform: "translate(-50%, -50%)",
            opacity: 0.06,
            zIndex: 0,
          }}
        />

        {/* Content wrapper above watermark */}
        <div className="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Aptis Kỳ Tích"
              className="w-14 h-14 object-contain"
            />
            <div>
              <div className="font-bold tracking-wide" style={{ color: BRAND_BROWN }}>APTIS KỲ TÍCH</div>
              <div className="text-xs text-neutral-500">aptiskytich.vn</div>
            </div>
          </div>
          <div className="text-xs text-neutral-400 text-right leading-tight">
            Copy of the<br />original certificate
          </div>
        </div>

        {/* Aptis ESOL title */}
        <div className="mb-1 text-2xl font-semibold" style={{ color: BRAND_RED }}>Aptis ESOL</div>
        <div className="h-[3px] w-16 mb-4" style={{ backgroundColor: BRAND_RED }} />
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Practice Score Report</h1>

        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <div className="text-lg font-semibold text-neutral-900">{displayName || "—"}</div>
            <div className="text-xs text-neutral-500 mt-1 border-t border-neutral-300 pt-1">Test taker name</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-900">{testDate}</div>
            <div className="text-xs text-neutral-500 mt-1 border-t border-neutral-300 pt-1">Test date</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-900">{refNumber}</div>
            <div className="text-xs text-neutral-500 mt-1 border-t border-neutral-300 pt-1">Test taker reference number</div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div>
            <div className="text-sm font-semibold text-neutral-900">aptiskytich.vn</div>
            <div className="text-xs text-neutral-500 mt-1 border-t border-neutral-300 pt-1">Test Centre</div>
          </div>
          <div className="col-span-2">
            <div className="text-sm font-semibold text-neutral-900">British Council – Aptis General</div>
            <div className="text-xs text-neutral-500">Aptis ESOL General (mô phỏng)</div>
          </div>
        </div>

        {/* Score box */}
        <div className="rounded-md p-5 mb-8" style={{ border: `2px solid ${BRAND_NAVY}` }}>
          <div className="mb-4">
            <span className="font-semibold" style={{ color: BRAND_RED }}>Overall CEFR level: </span>
            <span className="font-bold text-lg" style={{ color: BRAND_NAVY }}>{showBand(overallBand)}</span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Scale score */}
            <div>
              <div className="font-semibold mb-2" style={{ color: BRAND_NAVY }}>Scale score</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-neutral-600 border-b border-neutral-300">
                    <th className="text-left font-medium py-1">Skill name</th>
                    <th className="text-right font-medium py-1">Skill score</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-800">
                  <tr className="border-b border-neutral-200"><td className="py-1">Listening</td><td className="text-right py-1">{listening !== null ? `${listening}/50` : "—"}</td></tr>
                  <tr className="border-b border-neutral-200"><td className="py-1">Reading</td><td className="text-right py-1">{reading !== null ? `${reading}/50` : "—"}</td></tr>
                  <tr className="border-b border-neutral-200"><td className="py-1">Speaking</td><td className="text-right py-1">{speaking !== null ? `${speaking}/50` : "—"}</td></tr>
                  <tr className="border-b border-neutral-200"><td className="py-1">Writing</td><td className="text-right py-1">{writing !== null ? `${writing}/50` : "—"}</td></tr>
                  <tr className="border-b border-neutral-200 font-bold" style={{ color: BRAND_RED }}>
                    <td className="py-1">Final scale score</td>
                    <td className="text-right py-1">{totalScore !== null ? `${totalScore}/200` : "—"}</td>
                  </tr>
                  <tr><td className="py-1">Grammar and vocabulary</td><td className="text-right py-1">{grammar !== null ? `${grammar}/50` : "—"}</td></tr>
                </tbody>
              </table>
            </div>

            {/* CEFR skill profile chart */}
            <div>
              <div className="font-semibold mb-2" style={{ color: BRAND_NAVY }}>CEFR skill profile</div>
              <div className="text-xs text-neutral-600 mb-1">CEFR grade</div>
              <div className="flex">
                {/* Y-axis */}
                <div className="flex flex-col justify-between text-xs text-neutral-700 pr-2" style={{ height: 180 }}>
                  {Y_LEVELS.map((lvl) => (
                    <div key={lvl} className="leading-none">{lvl}</div>
                  ))}
                </div>
                {/* Bars */}
                <div className="flex-1 relative" style={{ height: 180 }}>
                  {/* gridlines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {Y_LEVELS.map((lvl) => (
                      <div key={lvl} className="border-t border-neutral-200 h-0" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-end gap-2 px-1">
                    {chartBars.map((b, i) => {
                      const h = heightForBand(b.band);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          {b.band ? (
                            <>
                              <div className="text-[10px] font-semibold mb-0.5" style={{ color: b.color }}>
                                {showBand(b.band)}
                              </div>
                              <div
                                className="w-full rounded-t"
                                style={{ height: `${h}%`, backgroundColor: b.color, minHeight: 4 }}
                              />
                            </>
                          ) : (
                            <div className="text-[10px] text-neutral-400 mb-0.5">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* X labels */}
              <div className="flex mt-1 pl-6">
                {chartBars.map((b, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-neutral-700 whitespace-pre-line leading-tight">
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-3 gap-6 items-end mt-10">
          <div>
            <div className="h-8 border-b border-neutral-400" />
            <div className="text-xs text-neutral-500 mt-1">Signed</div>
          </div>
          <div className="flex justify-center">
            <div
              className="rounded-full flex flex-col items-center justify-center text-[10px] font-bold text-center leading-tight"
              style={{
                width: 92,
                height: 92,
                border: `2px solid ${BRAND_RED}`,
                color: BRAND_RED,
                transform: "rotate(-8deg)",
              }}
            >
              <div>APTIS</div>
              <div>KỲ TÍCH</div>
              <div className="mt-1 text-[9px]">{testDate}</div>
            </div>
          </div>
          <div>
            <div className="h-8 border-b border-neutral-400" />
            <div className="text-xs text-neutral-500 mt-1">Centre stamp and date</div>
          </div>
        </div>

        <p className="text-[10px] text-neutral-400 text-center mt-6 italic">
          Phiếu điểm mô phỏng cho mục đích luyện tập, không phải chứng chỉ chính thức của British Council.
        </p>
      </div>
    </div>
  );
});

PracticeScoreReport.displayName = "PracticeScoreReport";

export default PracticeScoreReport;
