import { useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import SpeakingHeader from "./SpeakingHeader";
import SpeakingProfileView from "./SpeakingProfileView";
import type { SpeakingPartResultV2 } from "./speakingGradingV2";

export interface SpeakingV2PartEntry {
  partType: "part1" | "part2" | "part3" | "part4";
  partNumber: number;
  result: SpeakingPartResultV2;
  recordingUrls: (string | null)[];
}

interface Props {
  parts: SpeakingV2PartEntry[];
  scale50: number;
  cefr: string;
  greyZone: boolean;
  flagReview: boolean;
  rawTotal: number;
  onExit: () => void;
  isGrading?: boolean;
  gradingMessage?: string;
}

const SpeakingFullResultsV2 = ({
  parts,
  scale50,
  cefr,
  greyZone,
  flagReview,
  rawTotal,
  onExit,
  isGrading,
  gradingMessage,
}: Props) => {
  const [reviewDetail, setReviewDetail] = useState(false);
  const [reviewPartIdx, setReviewPartIdx] = useState(0);

  const current = parts[reviewPartIdx];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SpeakingHeader partLabel="Speaking" partNumber={4} totalParts={4} onExit={onExit} />
      <div className="flex-1 px-4 py-8">
        {!reviewDetail ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-emerald-500" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground mb-1">
                Bài Speaking đã được nộp
              </h2>
              <p className="text-sm text-muted-foreground">
                AI Kỳ Tích đã chấm xong 4 phần.
              </p>
            </div>

            {isGrading && (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {gradingMessage || "AI Kỳ Tích đang chấm..."}
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tổng điểm Speaking
              </p>
              <p className="text-5xl font-heading font-bold text-primary">
                {scale50}
                <span className="text-base text-muted-foreground"> / 50</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {cefr && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                    CEFR: {cefr}
                  </span>
                )}
                {greyZone && (
                  <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    Vùng xám
                  </span>
                )}
                {flagReview && (
                  <span className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium">
                    Cần xem lại
                  </span>
                )}
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-2">
                {parts.map((p) => (
                  <div key={p.partNumber} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Speaking Part {p.partNumber}</span>
                    <span className="font-mono text-foreground">
                      raw {Number(p.result.rawPart || 0).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setReviewPartIdx(0); setReviewDetail(true); }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                🎙️ Xem lại từng phần
              </button>
              <button
                onClick={onExit}
                className="bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Quay lại
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
              <button
                onClick={() => setReviewDetail(false)}
                className="text-xs bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-3 py-1.5 font-medium"
              >
                ← Tổng kết
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReviewPartIdx((i) => Math.max(0, i - 1))}
                  disabled={reviewPartIdx === 0}
                  className="flex items-center gap-1 text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 text-foreground rounded-lg px-3 py-1.5 font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Part trước
                </button>
                <span className="text-sm font-semibold text-foreground">
                  Speaking Part {current?.partNumber}
                </span>
                <button
                  onClick={() => setReviewPartIdx((i) => Math.min(parts.length - 1, i + 1))}
                  disabled={reviewPartIdx >= parts.length - 1}
                  className="flex items-center gap-1 text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 text-foreground rounded-lg px-3 py-1.5 font-medium"
                >
                  Part sau <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {current && (
              <SpeakingProfileView
                bands={current.result.bands}
                items={current.result.perItem.map((it, i) => ({
                  questionText: it.questionText,
                  transcript: it.transcript,
                  onTopic: it.onTopic,
                  audioUrl: current.recordingUrls[i] ?? null,
                }))}
                analysis={current.result.analysis}
                improvedVersion={current.result.improvedVersion}
                partLabel={`Part ${current.partNumber}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakingFullResultsV2;
