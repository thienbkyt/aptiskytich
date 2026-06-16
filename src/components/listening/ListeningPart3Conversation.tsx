import { Bookmark } from "lucide-react";
import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import type { ListeningPart3Question } from "@/data/listeningQuestions";
import ScriptBlock from "@/components/listening/ScriptBlock";
import { l3Id } from "@/lib/listeningReview";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface Props {
  questions: ListeningPart3Question[];
  currentIndex: number;
  answers: any[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onAnswer: (qi: number, ai: any) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  sections?: QuestionSection[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onSubmitTest?: () => void;
}

const ANSWER_OPTIONS = [
  { value: "man", label: "Man" },
  { value: "woman", label: "Woman" },
  { value: "both", label: "Both" },
];

const ListeningPart3Conversation = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
  isBookmarked = false, onToggleBookmark, onSubmitTest,
}: Props) => {
  const q = questions[currentIndex];
  if (!q) return null;

  const selected: Record<number, string> = (answers[currentIndex] || {}) as Record<number, string>;

  const handleSelect = (idx: number, value: string) => {
    if (submitted) return;
    onAnswer(currentIndex, { ...selected, [idx]: value });
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-base text-foreground mb-1">Listening</p>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </h2>
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

      <div className="flex-1">
        <p className="text-base text-foreground leading-relaxed mb-4">{q.questionText}</p>

        <LimitedAudioPlayer src={q.audioUrl} maxPlays={2} questionKey={q.id} />

        <p className="text-sm text-foreground mt-8 mb-6">Who expresses which opinion?</p>

        <div className="space-y-7">
          {q.statements.map((s, i) => {
            const value = selected[i] || "";
            let selectCls = "border-border bg-background";
            if (submitted) {
              if (value === s.correctAnswer) selectCls = "border-emerald-500 bg-emerald-500/10";
              else selectCls = "border-destructive bg-destructive/10";
            }
            return (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <p className="text-base text-foreground">
                  {i + 1}. {s.text}
                </p>
                <select
                  value={value}
                  onChange={(e) => handleSelect(i, e.target.value)}
                  disabled={submitted}
                  className={`border rounded-md px-3 py-1.5 text-sm text-foreground disabled:opacity-70 ${selectCls}`}
                >
                  <option value=""></option>
                  {ANSWER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {submitted && q.script && (
          <div className="mt-6 border border-border rounded-md p-4 bg-muted/30">
            <p className="text-sm font-heading font-bold text-foreground mb-2">Script</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{q.script}</p>
          </div>
        )}
      </div>

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

export default ListeningPart3Conversation;
