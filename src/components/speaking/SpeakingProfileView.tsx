import { useMemo } from "react";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import type { SpeakingPartResultV2 } from "./speakingGradingV2";

const CRITERIA: Array<{ key: keyof SpeakingPartResultV2["bands"]; label: string; vi: string }> = [
  { key: "tf", label: "TF", vi: "Hoàn thành yêu cầu (Task Fulfilment)" },
  { key: "gra", label: "GRA", vi: "Ngữ pháp (Grammatical Range & Accuracy)" },
  { key: "vra", label: "VRA", vi: "Từ vựng (Vocabulary Range & Accuracy)" },
  { key: "pro", label: "PRO", vi: "Phát âm (Pronunciation)" },
  { key: "fc", label: "FC", vi: "Trôi chảy & Mạch lạc (Fluency & Coherence)" },
];

function bandToNumber(b: string | number | null | undefined): number | null {
  if (b == null) return null;
  if (typeof b === "number") return b;
  const m = String(b).match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : null;
}

function bandColor(n: number | null): string {
  if (n == null) return "bg-muted";
  if (n >= 4) return "bg-emerald-500";
  if (n >= 3) return "bg-amber-500";
  if (n >= 2) return "bg-orange-500";
  return "bg-rose-500";
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
  feedback?: string;
  analysis?: string;
  scale50?: number | null;
  cefr?: string | null;
  partLabel?: string;
}

const SpeakingProfileView = ({
  bands,
  items,
  feedback,
  analysis,
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

        <div className="mt-5 space-y-3">
          {rows.map((r) => {
            const pct = r.value != null ? (r.value / 5) * 100 : 0;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="text-foreground">
                    <span className="font-bold mr-2">{r.label}</span>
                    <span className="text-muted-foreground text-xs">{r.vi}</span>
                  </div>
                  <span className="font-mono font-semibold text-foreground">
                    {r.value != null ? r.value.toFixed(1) : "—"}<span className="text-muted-foreground">/5</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${bandColor(r.value)} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {analysis && (
          <div className="mt-5 p-4 rounded-lg bg-muted/40 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phân tích</p>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{analysis}</p>
          </div>
        )}

        {feedback && (
          <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-primary uppercase mb-1">Nhận xét chung</p>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{feedback}</p>
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

            {it.improvedVersion && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-semibold text-primary uppercase">
                    Phiên bản AI Kỳ Tích gợi ý
                  </p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {it.improvedVersion}
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
