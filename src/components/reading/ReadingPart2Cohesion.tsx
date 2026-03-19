import { useState, Fragment } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingCohesionQuestion } from "@/data/readingQuestions";

interface Props {
  question: ReadingCohesionQuestion;
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
}

const ReadingPart2Cohesion = ({
  question, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections,
}: Props) => {
  const [bookmarked, setBookmarked] = useState(false);

  const renderPassage = () => {
    const parts = question.passage.split(/\{(\d+)\}/g);
    return (
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
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
                value={selectedValue !== null && selectedValue !== undefined ? selectedValue : ""}
                onChange={(e) => onAnswer(gapIndex, parseInt(e.target.value))}
                disabled={submitted}
                className={`inline-block mx-1 px-3 py-1.5 text-sm border rounded-lg bg-background appearance-auto cursor-pointer min-w-[200px]
                  ${submitted
                    ? isCorrect
                      ? "border-success bg-success/10 text-success"
                      : isWrong
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border"
                    : selectedValue !== null && selectedValue !== undefined
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
              >
                <option value="" disabled>── Choose a sentence ──</option>
                {question.sentenceOptions.map((opt, oi) => (
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading – Part 2</p>
          <p className="text-sm text-foreground mt-1">{question.instruction}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              bookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl p-6 mb-6">
        {renderPassage()}
      </div>

      {submitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-muted/50 rounded-xl p-4 mb-6 text-sm"
        >
          <p className="font-semibold text-foreground mb-2">Đáp án đúng:</p>
          {question.gaps.map((gap, i) => (
            <p key={i} className="text-muted-foreground">
              Gap {i + 1}: <span className="text-success font-medium">{question.sentenceOptions[gap.correct]}</span>
              {answers[i] !== null && answers[i] !== gap.correct && (
                <span className="text-destructive ml-2">
                  (Bạn chọn: {answers[i] !== null ? question.sentenceOptions[answers[i]!] : "—"})
                </span>
              )}
            </p>
          ))}
          <p className="mt-2 text-muted-foreground">{question.explanation}</p>
        </motion.div>
      )}

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

export default ReadingPart2Cohesion;
