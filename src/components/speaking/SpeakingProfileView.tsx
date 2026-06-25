import { useMemo } from "react";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { SpeakingPartResultV2 } from "./speakingGradingV2";

const CRITERIA: Array<{ key: keyof SpeakingPartResultV2["bands"]; label: string; vi: string; viShort: string }> = [
  { key: "tf", label: "TF", vi: "Hoàn thành yêu cầu (Task Fulfilment)", viShort: "Nội dung" },
  { key: "gra", label: "GRA", vi: "Ngữ pháp (Grammatical Range & Accuracy)", viShort: "Ngữ pháp" },
  { key: "vra", label: "VRA", vi: "Từ vựng (Vocabulary Range & Accuracy)", viShort: "Từ vựng" },
  { key: "pro", label: "PRO", vi: "Phát âm (Pronunciation)", viShort: "Phát âm" },
  { key: "fc", label: "FC", vi: "Trôi chảy & Mạch lạc (Fluency & Coherence)", viShort: "Sự trôi chảy" },
];

function bandToNumber(b: string | number | null | undefined): number | null {
  if (b == null) return null;
  if (typeof b === "number") return b;
  const m = String(b).match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : null;
}

interface SpeakingProfileViewProps {
  bands: SpeakingPartResultV2["bands"];
  items: Array<{
    questionText?: string;
    transcript?: string;
    onTopic?: boolean;
    improvedVersion?: string;
    audioUrl?: string | null;
  }>;
  /** @deprecated kept for backward compat; not rendered. */
  feedback?: string;
  analysis?: string;
  /** Part-level improved English version (from edge speaking_v2). */
  improvedVersion?: string;
  scale50?: number | null;
  cefr?: string | null;
  partLabel?: string;
}

const SpeakingProfileView = ({
  bands,
  items,
  analysis,
  improvedVersion,
  scale50 = null,
  cefr = null,
  partLabel,
}: SpeakingProfileViewProps) => {
  const rows = useMemo(
    () =>
      CRITERIA.map((c) => {
        const n = bandToNumber((bands as any)?.[c.key]);
        return { ...c, value: n };
      }),
    [bands],
  );

  const radarData = useMemo(
    () =>
      rows.map((r) => ({
        criterion: `${r.viShort} (${r.label})`,
        value: r.value ?? 0,
      })),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI Kỳ Tích</p>
        </div>
        <h3 className="text-lg font-heading font-bold text-foreground">
          Hồ sơ chẩn đoán Speaking{partLabel ? ` — ${partLabel}` : ""}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Profile 5 tiêu chí (band 0–5). Đây là kết quả chẩn đoán cho bài lẻ — không quy đổi điểm tổng.
        </p>

        {(scale50 != null || cefr) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {scale50 != null && (
              <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                Scale 50: {scale50}
              </div>
            )}
            {cefr && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                CEFR: {cefr}
              </div>
            )}
          </div>
        )}

        {/* Radar chart 5 trục */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4 items-center">
          <div className="w-full h-[280px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="criterion"
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  tickCount={6}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Radar
                  name="Band"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {r.viShort} <span className="text-xs text-muted-foreground font-normal">({r.label})</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.vi}</p>
                </div>
                <span className="font-mono font-semibold text-foreground shrink-0">
                  {r.value != null ? r.value.toFixed(1) : "—"}
                  <span className="text-muted-foreground">/5</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {analysis && (
          <div className="mt-5 p-4 rounded-lg bg-muted/40 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phân tích bài làm</p>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{analysis}</p>
          </div>
        )}

        {improvedVersion && (
          <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-semibold text-primary uppercase">
                Phiên bản AI Kỳ Tích gợi ý cho bạn
              </p>
            </div>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {improvedVersion}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Câu {idx + 1}
                </p>
                {it.questionText && (
                  <p className="text-sm text-foreground mt-1 leading-relaxed">{it.questionText}</p>
                )}
              </div>
              {typeof it.onTopic === "boolean" && (
                <div
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                    it.onTopic
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {it.onTopic ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đúng chủ đề
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" /> Lệch chủ đề
                    </>
                  )}
                </div>
              )}
            </div>

            {it.audioUrl && (
              <audio controls src={it.audioUrl} className="w-full h-9" preload="metadata" />
            )}

            {it.transcript && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Transcript</p>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {it.transcript}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpeakingProfileView;
