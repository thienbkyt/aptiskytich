import { Bookmark, Check, X } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import MissingMediaNotice from "@/components/exam/MissingMediaNotice";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import { motion, AnimatePresence } from "framer-motion";
import type { ListeningPart2Question } from "@/data/listeningQuestions";
import ScriptBlock from "@/components/listening/ScriptBlock";
import { l2Id } from "@/lib/listeningReview";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

export type Part2AnswerMap = Record<string, string>;

interface Props {
  questions: ListeningPart2Question[];
  currentIndex: number;
  answers: (Part2AnswerMap | null)[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  revealAnswers?: boolean;
  onAnswer: (qi: number, ai: Part2AnswerMap) => void;
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

const ListeningPart2Match = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, revealAnswers, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
  isBookmarked = false, onToggleBookmark, onSubmitTest,
  highlights = {}, highlightLoading, hideTimer, pageNumber, pageTotal,
}: Props) => {
  const reveal = submitted || !!revealAnswers;
  const q = questions[currentIndex];
  if (!q) return null;

  const current: Part2AnswerMap = answers[currentIndex] || {};
  // Use first person's audio (or q.audioUrl) for the single Play/Stop button
  const audioSrc = q.audioUrl || q.persons?.[0]?.audioUrl || "";

  const handleSelect = (speakerName: string, text: string) => {
    if (reveal) return;
    onAnswer(currentIndex, { ...current, [speakerName]: text });
  };

  const getCorrectTextForSpeaker = (speakerName: string): string | null => {
    const item = q.infoItems.find((it) => it.correctPerson === speakerName);
    return item ? item.text : null;
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Listening – Part 2</p>
          <p className="text-sm text-foreground">
            {pageNumber != null && pageTotal != null
              ? `Question ${pageNumber} of ${pageTotal}`
              : `Question ${currentIndex + 1} of ${questions.length}`}
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
          <p className="text-sm text-foreground mb-1">{q.questionText}</p>
          <LimitedAudioPlayer src={audioSrc} maxPlays={2} questionKey={q.id} />

          <div className="mt-4 space-y-3">
            {q.persons.map((person) => {
              const selectedText = current[person.name] || "";
              const correctText = getCorrectTextForSpeaker(person.name);
              const isCorrect = reveal && selectedText && selectedText === correctText;
              const isWrong = reveal && selectedText && selectedText !== correctText;

              let selectCls = "border-border bg-background text-foreground";
              if (isCorrect) selectCls = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
              else if (isWrong) selectCls = "border-destructive bg-destructive/10 text-destructive";

              return (
                <div key={person.name} className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm text-foreground shrink-0 w-24">
                    Speaker {person.name} ...
                  </label>
                  <select
                    value={selectedText}
                    onChange={(e) => handleSelect(person.name, e.target.value)}
                    disabled={reveal}
                    className={`flex-1 max-w-md text-sm px-3 py-1.5 rounded border transition-colors ${selectCls} ${
                      reveal ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <option value=""></option>
                    {q.infoItems.map((item, i) => (
                      <option key={i} value={item.text}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                  {reveal && (
                    <>
                      {selectedText === correctText ? (
                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-destructive shrink-0" />
                      )}
                      {reveal && selectedText !== correctText && correctText && (
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                          → {correctText}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {reveal && q.script && (
            <ScriptBlock
              script={q.script}
              spans={q.persons.map((p) => highlights[l2Id(p.name)]).filter(Boolean) as string[]}
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

export default ListeningPart2Match;
