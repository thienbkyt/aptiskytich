import { CheckCircle2, XCircle } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import { motion, AnimatePresence } from "framer-motion";
import type { ListeningPart4Question } from "@/data/listeningQuestions";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface Props {
  questions: ListeningPart4Question[];
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
}

const ListeningPart4Monologue = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
}: Props) => {
  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];

  // Part 4: all questions share the same audio, show player only on first question
  const showAudio = currentIndex === 0 || questions[currentIndex].audioUrl !== questions[currentIndex - 1]?.audioUrl;

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Listening – Part 4</p>
          <p className="text-sm text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
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
          {/* Always show player - shared audio for all questions in Part 4 */}
          <LimitedAudioPlayer src={q.audioUrl} maxPlays={2} questionKey={`part4-${q.audioUrl}`} />

          <div className="bg-background rounded-xl p-6 mb-6">
            <h2 className="text-sm font-heading font-bold text-foreground mb-6">
              {q.questionText}
            </h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                let cls = "border-border hover:border-primary/30 text-foreground hover:bg-muted/50";
                if (submitted) {
                  if (i === q.correct) cls = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
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
          </div>
        </motion.div>
      </AnimatePresence>

      <BottomNavBar
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={isFirst}
        isLast={isLast}
        sections={sections}
      />
    </div>
  );
};

export default ListeningPart4Monologue;
