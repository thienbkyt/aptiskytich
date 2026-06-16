import { Fragment, memo } from "react";
import { Bookmark, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingSentenceQuestion } from "@/data/readingQuestions";
import { part1ItemId, buildPart1SentenceForGap, type ReadingReviewData } from "@/lib/readingReview";

interface Props {
  question: ReadingSentenceQuestion;
  answers: (number | null)[];
  timeLeft?: number;
  totalTime?: number;
  submitted: boolean;
  onAnswer: (gapIndex: number, value: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
  onSubmitTest?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  reviewData?: ReadingReviewData | null;
  reviewDataLoading?: boolean;
  hideTimer?: boolean;
}

const ReadingPart1Sentence = ({
  question, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections, onSubmitTest,
  isBookmarked = false, onToggleBookmark,
  reviewData, reviewDataLoading, hideTimer = false,
}: Props) => {

  const renderPassage = () => {
    const parts = question.passage.split(/\{(\d+)\}/g);
    return (
      <div className="text-base text-foreground leading-[2.2] whitespace-pre-line">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            const gapIndex = parseInt(part);
            const gap = question.gaps[gapIndex];
            if (!gap) return null;
            const selectedValue = answers[gapIndex];
            const isCorrect = submitted && selectedValue === gap.correct;
            const isWrong = submitted && selectedValue !== null && selectedValue !== gap.correct;

            return (
              <select
                key={`gap-${gapIndex}`}
                data-question-index={gapIndex}
                value={selectedValue !== null && selectedValue !== undefined ? selectedValue : ""}
                onChange={(e) => onAnswer(gapIndex, parseInt(e.target.value))}
                disabled={submitted}
                className={`inline-block mx-1 px-3 py-1 text-sm border rounded bg-background appearance-auto cursor-pointer min-w-[120px]
                  ${submitted
                    ? isCorrect
                      ? "border-success bg-success/10 text-success"
                      : isWrong
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border"
                    : selectedValue !== null && selectedValue !== undefined
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
              >
                <option value="" disabled>{selectedValue !== null && selectedValue !== undefined ? "" : "──"}</option>
                {gap.options.map((opt, oi) => (
                  <option key={oi} value={oi}>{opt}</option>
                ))}
              </select>
            );
          }
          return <Fragment key={i}>{part}</Fragment>;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-sm text-foreground">Reading Đề 01</p>
          <p className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
            Question 1 of ​5
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
              isBookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          <TimerDisplay />
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full">
        <p className="text-base font-bold text-foreground mb-8">{question.instruction}</p>
        {renderPassage()}

        {submitted && (
          <div className="mt-10 border-t border-border pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Đáp án &amp; dịch nghĩa</p>
              {reviewDataLoading && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang dịch…
                </span>
              )}
            </div>
            <div className="space-y-3">
              {(() => {
                const usedGapIdx = [...question.passage.matchAll(/\{(\d+)\}/g)]
                  .map(m => Number(m[1]))
                  .filter(idx => question.gaps[idx]);
                return usedGapIdx.map((gi, displayIdx) => {
                  const g = question.gaps[gi];
                  const userVal = answers[gi];
                  const userText = userVal !== null && userVal !== undefined ? g.options[userVal] : "—";
                  const isCorrect = userVal === g.correct;
                  const correctText = g.options[g.correct];
                  const translation = reviewData?.translations?.[part1ItemId(gi)];
                  const sentenceEn = buildPart1SentenceForGap(question, gi);
                  return (
                    <div key={gi} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start gap-3 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground mt-0.5 min-w-[20px]">{displayIdx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground italic mb-2">{sentenceEn}</p>
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            {isCorrect ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {userText}
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 line-through">
                                  <XCircle className="w-3.5 h-3.5" /> {userText}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {correctText}
                                </span>
                              </>
                            )}
                          </div>
                          {translation ? (
                            <p className="mt-2 text-sm text-foreground">
                              <span className="text-muted-foreground">Dịch: </span>
                              {translation}
                            </p>
                          ) : reviewDataLoading ? (
                            <p className="mt-2 text-xs text-muted-foreground italic">Đang dịch…</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      <BottomNavBar
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={isFirst}
        isLast={isLast}
        submitLabel="Submit"
        sections={sections}
        onSubmitTest={onSubmitTest}
      />
    </div>
  );
};

export default memo(ReadingPart1Sentence);
