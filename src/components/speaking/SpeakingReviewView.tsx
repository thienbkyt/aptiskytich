import { useState } from "react";
import { Loader2 } from "lucide-react";
import SignedImage from "@/components/exam/SignedImage";
import type {
  SpeakingPartType,
  SpeakingPart1Data,
  SpeakingPart2Data,
  SpeakingPart3Data,
  SpeakingPart4Data,
} from "@/data/speakingQuestions";
import type { SpeakingGradingResult } from "./speakingGrading";
import { safeText } from "@/lib/safeText";

const PART_NUMBERS: Record<SpeakingPartType, number> = {
  part1: 1, part2: 2, part3: 3, part4: 4,
};

export interface SpeakingReviewViewProps {
  partType: SpeakingPartType;
  part1Data?: SpeakingPart1Data;
  part2Data?: SpeakingPart2Data;
  part3Data?: SpeakingPart3Data;
  part4Data?: SpeakingPart4Data;
  /** One signed audio URL per question. */
  recordings: (string | null)[];
  /** One grading per call to grade-exam. Part 4 has length 1. */
  gradings: (SpeakingGradingResult | null)[];
  reviewIndex: number;
  onChangeIndex: (next: number) => void;
  onBack: () => void;
  onExit?: () => void;
  totalParts?: number;
  hidePager?: boolean;
  /** Re-grade a single question (the one currently shown). The parent is
   *  responsible for actually calling the grader and persisting the result. */
  onRegrade?: (gradingIndex: number) => Promise<void>;
}

/**
 * Per-question review for Speaking — renders the original exam-taking layout
 * on the left and the AI grading + audio playback on the right. Pure
 * presentation: no fetching, no DB writes.
 */
const SpeakingReviewView = ({
  partType, part1Data, part2Data, part3Data, part4Data,
  recordings, gradings, reviewIndex, onChangeIndex, onBack, onExit,
  totalParts = 4, hidePager = false, onRegrade,
}: SpeakingReviewViewProps) => {
  const [regradingIdx, setRegradingIdx] = useState<number | null>(null);
  const partNumber = PART_NUMBERS[partType];

  const promptsList: string[] = (() => {
    if (partType === "part1" && part1Data) return part1Data.questions;
    if (partType === "part2" && part2Data) return part2Data.questions || [part2Data.prompt];
    if (partType === "part3" && part3Data) return part3Data.questions || [part3Data.prompt];
    if (partType === "part4" && part4Data) return [part4Data.topic];
    return [];
  })();

  const isPart4 = partType === "part4";
  const reviewTotal = isPart4 ? 1 : promptsList.length;
  const rIdx = Math.min(reviewIndex, Math.max(0, reviewTotal - 1));
  const prompt = promptsList[rIdx] ?? promptsList[0] ?? "";
  const gIdx = isPart4 ? 0 : rIdx;
  const g = gradings[gIdx];
  const audioUrl = recordings[rIdx];
  const canPrev = rIdx > 0;
  const canNext = rIdx < reviewTotal - 1;
  const showNav = reviewTotal > 1;

  return (
    <div className="-mx-4">
      <div className="px-4 flex items-center justify-between mb-4 max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Quay lại tổng kết
        </button>
        {showNav && !hidePager && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeIndex(Math.max(0, rIdx - 1))}
              disabled={!canPrev}
              className="text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
            >
              ← Câu trước
            </button>
            <span className="text-xs text-muted-foreground">
              {rIdx + 1} / {reviewTotal}
            </span>
            <button
              onClick={() => onChangeIndex(Math.min(reviewTotal - 1, rIdx + 1))}
              disabled={!canNext}
              className="text-xs bg-card border border-border hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed text-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
            >
              Câu sau →
            </button>
          </div>
        )}
        {onExit ? (
          <button
            onClick={onExit}
            className="text-sm bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-4 py-2 font-medium transition-colors"
          >
            Thoát
          </button>
        ) : <span />}
      </div>

      <div className="flex px-4 gap-6 max-w-6xl mx-auto w-full">
        {/* Left: same layout as exam-taking screen */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-8 min-h-[400px]">
            <p className="text-xs text-gray-500 mb-1">Speaking</p>
            <p className="text-sm font-bold text-gray-900 mb-6">
              {isPart4 ? `Part ${partNumber} of ${totalParts}` : `Question ${rIdx + 1} of ${reviewTotal}`}
            </p>

            {partType === "part2" && part2Data?.imageUrl && (
              <div className="mb-4">
                <SignedImage
                  src={part2Data.imageUrl}
                  alt="Describe this picture"
                  className="w-full max-w-md rounded-lg object-cover"
                />
              </div>
            )}

            {partType === "part3" && part3Data && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <SignedImage src={part3Data.imageUrl1} alt="Picture 1" className="w-full rounded-lg object-cover h-56" />
                <SignedImage src={part3Data.imageUrl2} alt="Picture 2" className="w-full rounded-lg object-cover h-56" />
              </div>
            )}

            {partType === "part4" && part4Data && (
              <div className="bg-gray-50 rounded-lg p-5 mb-4">
                <p className="font-bold text-gray-900 mb-3">Topic: {part4Data.topic}</p>
                {part4Data.imageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 max-w-md">
                    <SignedImage src={part4Data.imageUrl} alt="Part 4 topic" className="w-full h-56 object-cover" />
                  </div>
                )}
                <ul className="space-y-1.5 mb-3">
                  {part4Data.questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-700">• {q}</li>
                  ))}
                </ul>
              </div>
            )}

            {partType !== "part4" && (
              <p className="text-sm text-gray-800 mt-4">{prompt}</p>
            )}
          </div>
        </div>

        {/* Right: review panel — audio + AI grading */}
        <div className="w-[340px] shrink-0 space-y-3">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Bài ghi âm của bạn</p>
            {audioUrl ? (
              <audio controls src={audioUrl} className="w-full h-9" />
            ) : (
              <p className="text-xs text-muted-foreground italic">Không có bài ghi âm cho câu này.</p>
            )}
          </div>

          {(!g || "error" in g) ? (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <p className="text-xs text-muted-foreground italic">
                {g && "error" in g ? `Không chấm được câu này: ${g.error}` : "Chưa có kết quả chấm cho câu này."}
              </p>
              {onRegrade && audioUrl && (
                <button
                  onClick={async () => {
                    if (regradingIdx !== null) return;
                    setRegradingIdx(gIdx);
                    try { await onRegrade(gIdx); }
                    finally { setRegradingIdx(null); }
                  }}
                  disabled={regradingIdx !== null}
                  className="inline-flex items-center gap-2 text-xs bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
                >
                  {regradingIdx === gIdx && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {regradingIdx === gIdx ? "Đang chấm lại..." : "Chấm lại"}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Điểm AI Kỳ Tích chấm</p>
                  <p className="text-sm font-bold text-primary">
                    {g.partScore.toFixed(1)} / {g.maxPoints}
                  </p>
                </div>
                <div className="rounded-lg border border-[#24085a]/20 bg-[#24085a]/5 px-3 py-2">
                  <p className="text-[11px] font-semibold text-[#24085a] mb-0.5">📐 Tiêu chí chấm</p>
                  <p className="text-[11px] text-foreground/80 leading-snug">
                    AI Kỳ Tích chấm dựa trên: trả lời đúng & đủ ý đề · ngữ pháp · từ vựng · phát âm · độ trôi chảy.
                  </p>
                </div>
                {safeText((g as any).analysis) && (
                  <div className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-800 mb-0.5">🔎 Vì sao điểm này</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-snug">{safeText((g as any).analysis)}</p>
                  </div>
                )}
                {safeText(g.transcript) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Transcript</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{safeText(g.transcript)}</p>
                  </div>
                )}

                {g.grammarErrors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Lỗi ngữ pháp</p>
                    <ul className="text-xs text-foreground space-y-1 list-disc pl-4">
                      {g.grammarErrors.map((e, k) => (
                        <li key={k}>
                          <span className="line-through text-destructive">{e.original}</span>{" → "}
                          <span className="text-success font-medium">{e.corrected}</span>
                          <span className="text-muted-foreground"> — {e.explanation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {g.pronunciationErrors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Lỗi phát âm</p>
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
                {safeText(g.feedback) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Nhận xét</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{safeText(g.feedback)}</p>
                  </div>
                )}
              </div>


              {safeText(g.improvedVersion) && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-success mb-1">💡 Phiên bản AI Kỳ Tích gợi ý cho bạn</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{safeText(g.improvedVersion)}</p>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingReviewView;
