import LimitedAudioPlayer from "@/components/exam/LimitedAudioPlayer";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import type { ListeningPart3Question } from "@/data/listeningQuestions";

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
}

const ANSWER_OPTIONS = [
  { value: "man", label: "Man" },
  { value: "woman", label: "Woman" },
  { value: "both", label: "Both" },
];

const ListeningPart3Conversation = ({
  questions, currentIndex, answers, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections = [],
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Listening – Part 3</p>
          <p className="text-sm text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <div className="flex-1">
        <div className="bg-background rounded-xl p-6 mb-6">
          <p className="text-sm text-foreground mb-2">{q.questionText}</p>
          <p className="text-xs text-muted-foreground mb-4">Who expresses which opinion?</p>

          <LimitedAudioPlayer src={q.audioUrl} maxPlays={2} questionKey={q.id} />

          <div className="space-y-3 mt-4">
            {q.statements.map((s, i) => {
              const value = selected[i] || "";
              let cls = "border-border";
              if (submitted) {
                if (value === s.correctAnswer) cls = "border-emerald-500 bg-emerald-500/10";
                else cls = "border-destructive bg-destructive/10";
              } else if (value) {
                cls = "border-accent bg-accent/10";
              }
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${cls}`}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm text-foreground">{s.text}</p>
                  <select
                    value={value}
                    onChange={(e) => handleSelect(i, e.target.value)}
                    disabled={submitted}
                    className="border border-border bg-background rounded-md px-3 py-2 text-sm text-foreground disabled:opacity-70"
                  >
                    <option value="">--</option>
                    {ANSWER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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

export default ListeningPart3Conversation;
