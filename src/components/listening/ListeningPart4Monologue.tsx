import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import MissingMediaNotice from "@/components/exam/MissingMediaNotice";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import { motion, AnimatePresence } from "framer-motion";
import type { ListeningPart4Clip } from "@/data/listeningQuestions";
import ScriptBlock from "@/components/listening/ScriptBlock";
import { l4Id } from "@/lib/listeningReview";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface Props {
  questions: ListeningPart4Clip[];
  currentIndex: number;
  answers: Array<Record<number, number> | null>;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  revealAnswers?: boolean;
  onAnswer: (qi: number, ai: Record<number, number>) => void;
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
  hideTimer?: boolean;
  pageNumber?: number;
  pageTotal?: number;
}

const ListeningPart4Monologue = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, revealAnswers, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
  isBookmarked = false, onToggleBookmark, onSubmitTest,
  highlights = {}, highlightLoading, hideTimer, pageNumber, pageTotal,
}: Props) => {
  const reveal = submitted || !!revealAnswers;
  const clip = questions[currentIndex];
  if (!clip) return null;

  const clipAnswers: Record<number, number> = answers[currentIndex] || {};

  const handleSelect = (qi: number, oi: number) => {
    if (reveal) return;
    onAnswer(currentIndex, { ...clipAnswers, [qi]: oi });
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Listening – Part 4</p>
          <p className="text-sm text-foreground">
            {pageNumber != null && pageTotal != null
              ? `Question ${pageNumber} of ${pageTotal}`
              : `Recording ${currentIndex + 1} of ${questions.length}`}
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
          {!hideTimer && <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />}
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
          {clip.audioUrl ? (
            <LimitedAudioPlayer src={clip.audioUrl} maxPlays={2} questionKey={`part4-${clip.id}`} />
          ) : (
            <MissingMediaNotice kind="audio" skill="listening" partType="part4" questionNumber={currentIndex + 1} />
          )}

          <div className="space-y-8 mt-4">
            {clip.questions.map((qq, qi) => {
              const selected = clipAnswers[qi];
              return (
                <div key={qi}>
                  <p className="text-sm font-heading font-bold text-foreground mb-3">
                    {qi + 1}. {qq.text}
                  </p>
                  <div className="border border-border rounded-md overflow-hidden bg-background">
                    {qq.options.map((opt, oi) => {
                      const isLastRow = oi === qq.options.length - 1;
                      let cls = "bg-background hover:bg-muted/50 text-foreground";
                      if (reveal) {
                        if (oi === qq.correct) cls = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                        else if (oi === selected) cls = "bg-destructive/10 text-destructive";
                        else cls = "bg-background text-muted-foreground";
                      } else if (selected === oi) {
                        cls = "bg-muted-foreground/30 text-foreground";
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => handleSelect(qi, oi)}
                          disabled={reveal}
                          className={`w-full flex items-stretch text-left transition-colors ${cls} ${
                            !isLastRow ? "border-b border-border" : ""
                          }`}
                        >
                          <span className="flex items-center justify-center w-14 shrink-0 bg-muted/60 text-foreground font-heading font-semibold text-lg border-r border-border py-3">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="flex-1 px-4 py-3 text-sm flex items-center justify-between">
                            <span>{opt}</span>
                            {reveal && oi === qq.correct && <CheckCircle2 className="w-4 h-4" />}
                            {reveal && oi === selected && oi !== qq.correct && <XCircle className="w-4 h-4" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {reveal && clip.script && (
            <ScriptBlock
              script={clip.script}
              spans={clip.questions.map((_, qi) => highlights[l4Id(currentIndex, qi)]).filter(Boolean) as string[]}
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

export default ListeningPart4Monologue;
