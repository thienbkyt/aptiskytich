import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Bookmark } from "lucide-react";
import type { GapFillQuestion } from "@/data/questions";

interface ReadingGapFillProps {
  question: GapFillQuestion;
  questionIndex: number;
  totalQuestions: number;
  timeLeft?: number;
  answers: (number | null)[];
  onAnswerChange: (gapIndex: number, value: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isLast?: boolean;
  isFirst?: boolean;
  showResults?: boolean;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const ReadingGapFill = ({
  question,
  questionIndex,
  totalQuestions,
  timeLeft,
  answers,
  onAnswerChange,
  onPrevious,
  onNext,
  onSubmit,
  isLast,
  isFirst,
  showResults,
}: ReadingGapFillProps) => {
  const [bookmarked, setBookmarked] = useState(false);

  // Parse passage and render with inline dropdowns
  const renderPassage = () => {
    const parts = question.passage.split(/\{(\d+)\}/g);
    return (
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
        {parts.map((part, i) => {
          // Odd indices are gap numbers
          if (i % 2 === 1) {
            const gapIndex = parseInt(part);
            const gap = question.gaps[gapIndex];
            if (!gap) return null;
            const selectedValue = answers[gapIndex];
            const isCorrect = showResults && selectedValue === gap.correct;
            const isWrong = showResults && selectedValue !== null && selectedValue !== gap.correct;

            return (
              <select
                key={`gap-${gapIndex}`}
                value={selectedValue !== null && selectedValue !== undefined ? selectedValue : ""}
                onChange={(e) => onAnswerChange(gapIndex, parseInt(e.target.value))}
                disabled={showResults}
                className={`inline-block mx-1 px-2 py-1 text-sm border rounded-md bg-background appearance-auto cursor-pointer
                  ${showResults
                    ? isCorrect
                      ? "border-success bg-success/10 text-success"
                      : isWrong
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border"
                    : selectedValue !== null && selectedValue !== undefined
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }
                `}
              >
                <option value="" disabled>──</option>
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
    <div className="min-h-[70vh] flex flex-col">
      {/* Top bar: skill label, question counter, bookmark, timer */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading</p>
          <p className="text-sm text-foreground">
            Question {questionIndex + 1} of {totalQuestions}
          </p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {question.instruction}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              bookmarked
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          {timeLeft !== undefined && (
            <div className="text-right">
              <div className="font-mono text-xl font-bold text-foreground tracking-wider">
                {formatTime(timeLeft)}
              </div>
              <div className="text-xs text-muted-foreground border-t-2 border-primary pt-1">
                Time remaining
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Passage with gaps */}
      <div className="flex-1 bg-background rounded-xl p-6 mb-6">
        {renderPassage()}
      </div>

      {/* Show correct answers if in review mode */}
      {showResults && (
        <div className="bg-muted/50 rounded-xl p-4 mb-6 text-sm">
          <p className="font-semibold text-foreground mb-2">Đáp án đúng:</p>
          {question.gaps.map((gap, i) => (
            <p key={i} className="text-muted-foreground">
              Gap {i + 1}: <span className="text-success font-medium">{gap.options[gap.correct]}</span>
              {answers[i] !== null && answers[i] !== gap.correct && (
                <span className="text-destructive ml-2">
                  (Bạn chọn: {answers[i] !== null ? gap.options[answers[i]!] : "—"})
                </span>
              )}
            </p>
          ))}
          <p className="mt-2 text-muted-foreground">{question.explanation}</p>
        </div>
      )}

      {/* Bottom navigation bar */}
      <div className="border-t border-border bg-background py-4 flex items-center justify-between mt-auto">
        <div />
        <div className="flex items-center gap-3">
          {!isFirst && onPrevious && (
            <Button
              variant="outline"
              onClick={onPrevious}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </Button>
          )}
          {isLast && onSubmit ? (
            <Button
              onClick={onSubmit}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
            >
              Submit
            </Button>
          ) : onNext ? (
            <Button
              onClick={onNext}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ReadingGapFill;
