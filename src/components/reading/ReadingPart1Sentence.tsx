import { Fragment } from "react";
import { Bookmark } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingSentenceQuestion } from "@/data/readingQuestions";

interface Props {
  question: ReadingSentenceQuestion;
  answers: (number | null)[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onAnswer: (gapIndex: number, value: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

const ReadingPart1Sentence = ({
  question, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections,
  isBookmarked = false, onToggleBookmark,
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
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
              bookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full">
        <p className="text-base font-bold text-foreground mb-8">{question.instruction}</p>
        {renderPassage()}
      </div>

      <BottomNavBar
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={isFirst}
        isLast={isLast}
        submitLabel="Submit"
        sections={sections}
      />
    </div>
  );
};

export default ReadingPart1Sentence;
