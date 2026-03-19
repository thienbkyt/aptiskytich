import { useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingSentenceQuestion } from "@/data/readingQuestions";

interface Props {
  questions: ReadingSentenceQuestion[];
  currentIndex: number;
  answers: (number | null)[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onAnswer: (qi: number, ai: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
}

const ReadingPart1Sentence = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections,
}: Props) => {
  const [bookmarked, setBookmarked] = useState(false);
  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading – Part 1</p>
          <p className="text-sm text-foreground">Question {currentIndex + 1} of {questions.length}</p>
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

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          <div className="bg-card border border-border rounded-xl p-6 mb-4">
            <p className="text-sm text-muted-foreground mb-2">Read the sentence:</p>
            <p className="text-base font-medium text-foreground leading-relaxed italic">
              "{q.sentence}"
            </p>
          </div>

          <div className="bg-background rounded-xl p-6 mb-6">
            <h2 className="text-sm font-heading font-bold text-foreground mb-4">{q.question}</h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                let cls = "border-border hover:border-primary/30 text-foreground hover:bg-muted/50";
                if (submitted) {
                  if (i === q.correct) cls = "border-success bg-success/10 text-success";
                  else if (i === selected) cls = "border-destructive bg-destructive/10 text-destructive";
                  else cls = "border-border text-muted-foreground";
                } else if (selected === i) {
                  cls = "border-primary bg-primary/5 text-primary";
                }
                return (
                  <button
                    key={i}
                    onClick={() => !submitted && onAnswer(currentIndex, i)}
                    disabled={submitted}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${cls}`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                    {submitted && i === q.correct && <CheckCircle2 className="w-4 h-4 inline ml-2" />}
                    {submitted && i === selected && i !== q.correct && <XCircle className="w-4 h-4 inline ml-2" />}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`mt-4 p-4 rounded-lg ${
                  selected === q.correct ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                <p className={`text-sm font-semibold mb-1 ${selected === q.correct ? "text-success" : "text-destructive"}`}>
                  {selected === q.correct ? "✓ Chính xác!" : "✗ Sai rồi!"}
                </p>
                <p className="text-sm text-muted-foreground">{q.explanation}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

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
