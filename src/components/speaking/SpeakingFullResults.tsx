import { useState } from "react";
import { Loader2 } from "lucide-react";
import SpeakingHeader from "./SpeakingHeader";
import type { SpeakingPartType } from "@/data/speakingQuestions";
import type { SpeakingGradingResult, SpeakingItemGrading } from "./speakingGrading";

export interface SpeakingFullPartResult {
  partType: SpeakingPartType;
  partNumber: number;
  prompts: string[];               // length === gradings.length for parts 1-3; length 1 for part4 topic
  recordingUrls: (string | null)[];
  gradings: SpeakingGradingResult[];
  maxTotal: number;
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SpeakingHeader partLabel="Speaking" partNumber={4} totalParts={4} onExit={onExit} />
      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {!reviewDetail ? (
            <>
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
                  onClick={() => setReviewDetail(true)}
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
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setReviewDetail(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Quay lại tổng kết
                </button>
                <button
                  onClick={onExit}
                  className="text-sm bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-4 py-2 font-medium transition-colors"
                >
                  Thoát
                </button>
              </div>

              {parts.map((p) => {
                const isPart4 = p.partType === "part4";
                // Number of cards to render = number of distinct prompts / recordings
                const rowCount = Math.max(p.prompts.length, p.recordingUrls.length);
                return (
                  <div key={p.partNumber} className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="text-base font-heading font-bold text-foreground mb-4">
                      Speaking Part {p.partNumber}
                    </h3>
                    <div className="space-y-4">
                      {Array.from({ length: rowCount }).map((_, i) => {
                        const prompt = p.prompts[i] ?? p.prompts[0] ?? "";
                        const audioUrl = p.recordingUrls[i] ?? null;
                        const gIdx = isPart4 ? 0 : i;
                        const g = p.gradings[gIdx];
                        return (
                          <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Câu {i + 1}
                              </p>
                              <p className="text-sm text-foreground">{prompt}</p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Bài ghi âm của bạn
                              </p>
                              {audioUrl ? (
                                <audio controls src={audioUrl} className="w-full h-9" />
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  Không có bài ghi âm
                                </p>
                              )}
                            </div>

                            {g && "error" in g && (
                              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                                Không chấm được câu này: {g.error}
                              </div>
                            )}

                            {isGrading(g) && (
                              <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-foreground">
                                    Điểm AI Kỳ Tích chấm
                                  </p>
                                  <p className="text-sm font-bold text-primary">
                                    {g.partScore.toFixed(1)} / {g.maxPoints}
                                  </p>
                                </div>
                                {g.transcript && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                                      Transcript
                                    </p>
                                    <p className="text-xs text-foreground whitespace-pre-wrap">
                                      {g.transcript}
                                    </p>
                                  </div>
                                )}
                                {g.grammarErrors?.length > 0 && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                                      Lỗi ngữ pháp
                                    </p>
                                    <ul className="text-xs text-foreground space-y-1 list-disc pl-4">
                                      {g.grammarErrors.map((e, k) => (
                                        <li key={k}>
                                          <span className="line-through text-destructive">{e.original}</span>
                                          {" → "}
                                          <span className="text-success font-medium">{e.corrected}</span>
                                          <span className="text-muted-foreground"> — {e.explanation}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {g.pronunciationErrors?.length > 0 && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                                      Lỗi phát âm
                                    </p>
                                    <ul className="text-xs text-foreground space-y-1 list-disc pl-4">
                                      {g.pronunciationErrors.map((e, k) => (
                                        <li key={k}>
                                          <span className="font-medium">{e.word}</span>
                                          <span className="text-muted-foreground"> — {e.note}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {g.feedback && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                                      Nhận xét
                                    </p>
                                    <p className="text-xs text-foreground whitespace-pre-wrap">
                                      {g.feedback}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {isGrading(g) && g.improvedVersion && (
                              <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                                <p className="text-xs font-semibold text-success mb-1">
                                  💡 Phiên bản AI Kỳ Tích gợi ý cho bạn
                                </p>
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                  {g.improvedVersion}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingFullResults;
