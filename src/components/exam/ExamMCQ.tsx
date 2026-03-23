import { useState, useRef, useEffect } from "react";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "@/data/questions";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import { resolveAudioUrl } from "@/lib/audioUrl";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface ExamMCQProps {
  skillName: string;
  questions: Question[];
  currentIndex: number;
  answers: (number | null)[];
  timeLeft?: number;
  totalTime?: number;
  onAnswerSelect: (questionIndex: number, answerIndex: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  showResults?: boolean;
  sections?: QuestionSection[];
}

const ExamMCQ = ({
  skillName,
  questions,
  currentIndex,
  answers,
  timeLeft,
  totalTime = 600,
  onAnswerSelect,
  onPrevious,
  onNext,
  onSubmit,
  isFirst,
  isLast,
  showResults,
  sections = [],
}: ExamMCQProps) => {
  const [bookmarked, setBookmarked] = useState(false);
  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];
  const isCorrect = showResults && selected === q.correct_answer;
  const isWrong = showResults && selected !== null && selected !== q.correct_answer;

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">{skillName}</p>
          <p className="text-sm text-foreground">
            Question {currentIndex + 1} of {questions.length}
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
            <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
          )}
        </div>
      </div>

      {/* Audio player for listening (max 2 plays) */}
      {q.audio_url && (
        <LimitedAudioPlayer src={q.audio_url} maxPlays={2} questionKey={currentIndex} />
      )}

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          <div className="bg-background rounded-xl p-6 mb-6">
            <h2 className="text-sm font-heading font-bold text-foreground mb-6 leading-relaxed">
              {q.question_text}
            </h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                let cls = "border-border hover:border-primary/30 text-foreground hover:bg-muted/50";
                if (showResults) {
                  if (i === q.correct_answer) cls = "border-success bg-success/10 text-success";
                  else if (i === selected) cls = "border-destructive bg-destructive/10 text-destructive";
                  else cls = "border-border text-muted-foreground";
                } else if (selected === i) {
                  cls = "border-primary bg-primary/5 text-primary";
                }
                return (
                  <button
                    key={i}
                    onClick={() => !showResults && onAnswerSelect(currentIndex, i)}
                    disabled={showResults}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${cls}`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                    {showResults && i === q.correct_answer && <CheckCircle2 className="w-4 h-4 inline ml-2" />}
                    {showResults && i === selected && i !== q.correct_answer && <XCircle className="w-4 h-4 inline ml-2" />}
                  </button>
                );
              })}
            </div>

            {showResults && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`mt-4 p-4 rounded-lg ${
                  isCorrect ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                <p className={`text-sm font-semibold mb-1 ${isCorrect ? "text-success" : "text-destructive"}`}>
                  {isCorrect ? "✓ Chính xác!" : "✗ Sai rồi!"}
                </p>
                <p className="text-sm text-muted-foreground">{q.explanation}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Fixed bottom bar */}
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

export default ExamMCQ;
