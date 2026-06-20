import { useState } from "react";
import { Loader2 } from "lucide-react";
import SpeakingHeader from "./SpeakingHeader";
import SpeakingReviewView from "./SpeakingReviewView";
import type {
  SpeakingPartType,
  SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data,
} from "@/data/speakingQuestions";
import {
  buildSpeakingGradingSpecs, gradeSpeakingSpec, blobToBase64,
  type SpeakingGradingResult, type SpeakingItemGrading,
} from "./speakingGrading";

export interface SpeakingFullPartResult {
  partType: SpeakingPartType;
  partNumber: number;
  prompts: string[];
  recordingUrls: (string | null)[];
  gradings: SpeakingGradingResult[];
  maxTotal: number;
  // Original part data — needed to render the exam-taking layout in review.
  part1Data?: SpeakingPart1Data;
  part2Data?: SpeakingPart2Data;
  part3Data?: SpeakingPart3Data;
  part4Data?: SpeakingPart4Data;
}

interface Props {
  parts: SpeakingFullPartResult[];
  totalScore: number;
  totalMax: number;
  onExit: () => void;
}

const isGrading = (g: SpeakingGradingResult | null | undefined): g is SpeakingItemGrading =>
  !!g && typeof g === "object" && !("error" in g);

const SpeakingFullResults = ({ parts, totalScore, totalMax, onExit }: Props) => {
  const [reviewDetail, setReviewDetail] = useState(false);
  const [reviewPartIdx, setReviewPartIdx] = useState(0);
  const [reviewItemIdx, setReviewItemIdx] = useState(0);

  const currentPart = parts[reviewPartIdx];
  const canPrevPart = reviewPartIdx > 0;
  const canNextPart = reviewPartIdx < parts.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SpeakingHeader partLabel="Speaking" partNumber={4} totalParts={4} onExit={onExit} />
      <div className="flex-1 px-4 py-8">
        {!reviewDetail ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                Bài Speaking đã được nộp
              </h2>
              <p className="text-sm text-muted-foreground">
                Cảm ơn bạn đã hoàn thành phần Speaking.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tổng điểm Speaking
              </p>
              <p className="text-4xl font-heading font-bold text-primary">
                {totalScore.toFixed(1)}{" "}
                <span className="text-base text-muted-foreground">/ {totalMax}</span>
              </p>
              <div className="border-t border-border pt-3 mt-3 space-y-2">
                {parts.map((p) => {
                  const partScore = p.gradings.reduce(
                    (s, g) => s + (isGrading(g) ? g.partScore || 0 : 0),
                    0,
                  );
                  return (
                    <div key={p.partNumber} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Speaking Part {p.partNumber}</span>
                      <span className="font-bold text-foreground">
                        {partScore.toFixed(1)} / {p.maxTotal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setReviewPartIdx(0); setReviewItemIdx(0); setReviewDetail(true); }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                🎙️ Xem lại từng câu
              </button>
              <button
                onClick={onExit}
                className="bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Quay lại danh sách đề
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Part-level navigation header */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setReviewPartIdx((i) => Math.max(0, i - 1)); setReviewItemIdx(0); }}
                  disabled={!canPrevPart}
                  className="text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
                >
                  ← Part trước
                </button>
                <span className="text-sm font-semibold text-foreground">
                  Speaking Part {currentPart?.partNumber}
                </span>
                <button
                  onClick={() => { setReviewPartIdx((i) => Math.min(parts.length - 1, i + 1)); setReviewItemIdx(0); }}
                  disabled={!canNextPart}
                  className="text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
                >
                  Part sau →
                </button>
              </div>
            </div>

            {currentPart && (
              <SpeakingReviewView
                partType={currentPart.partType}
                part1Data={currentPart.part1Data}
                part2Data={currentPart.part2Data}
                part3Data={currentPart.part3Data}
                part4Data={currentPart.part4Data}
                recordings={currentPart.recordingUrls}
                gradings={currentPart.gradings}
                reviewIndex={reviewItemIdx}
                onChangeIndex={setReviewItemIdx}
                onBack={() => setReviewDetail(false)}
                onExit={onExit}
                totalParts={parts.length}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakingFullResults;
