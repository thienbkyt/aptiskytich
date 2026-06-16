import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import { motion, AnimatePresence } from "framer-motion";
import type { ListeningPart1Question } from "@/data/listeningQuestions";
import ScriptBlock from "@/components/listening/ScriptBlock";
import { l1Id } from "@/lib/listeningReview";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface Props {
  questions: ListeningPart1Question[];
  currentIndex: number;
  answers: (number | null)[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onAnswer: (qi: number, ai: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  sections?: QuestionSection[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onSubmitTest?: () => void;
  highlights?: Record<string, string>;
  highlightLoading?: boolean;
}

const ListeningPart1Word = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
  isBookmarked = false, onToggleBookmark, onSubmitTest,
  highlights = {}, highlightLoading,
}: Props) => {
  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Listening – Part 1</p>
          <p className="text-sm text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              isBookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-primary" : ""}`} />
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
          <p className="text-sm text-foreground mb-1">
            {q.questionText || "Which word do you hear?"}
          </p>
          <LimitedAudioPlayer src={q.audioUrl} maxPlays={2} questionKey={q.id} />

          <div className="mt-4 border border-border rounded-md overflow-hidden bg-background">
            {q.options.map((opt, i) => {
              const isLast = i === q.options.length - 1;
              let cls = "bg-background hover:bg-muted/50 text-foreground";
              if (submitted) {
                if (i === q.correct) cls = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                else if (i === selected) cls = "bg-destructive/10 text-destructive";
                else cls = "bg-background text-muted-foreground";
              } else if (selected === i) {
                cls = "bg-muted-foreground/30 text-foreground";
              }
              return (
                <button
                  key={i}
                  onClick={() => !submitted && onAnswer(currentIndex, i)}
                  disabled={submitted}
                  className={`w-full flex items-stretch text-left transition-colors ${cls} ${
                    !isLast ? "border-b border-border" : ""
                  }`}
                >
                  <span className="flex items-center justify-center w-14 shrink-0 bg-muted/60 text-foreground font-heading font-semibold text-lg border-r border-border py-3">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 px-4 py-3 text-sm flex items-center justify-between">
                    <span>{opt}</span>
                    {submitted && i === q.correct && <CheckCircle2 className="w-4 h-4" />}
                    {submitted && i === selected && i !== q.correct && <XCircle className="w-4 h-4" />}
                  </span>
                </button>
              );
            })}
          </div>

          {submitted && q.script && (
            <ScriptBlock
              script={q.script}
              spans={[highlights[l1Id(currentIndex)]].filter(Boolean) as string[]}
              loading={highlightLoading}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <BottomNavBar
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={isFirst}
        isLast={isLast}
        sections={sections}
        onSubmitTest={onSubmitTest}
      />
    </div>
  );
};

export default ListeningPart1Word;
