import { Bookmark } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart2Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart2Data;
  answer: string;
  onAnswerChange: (value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  onPrevious?: () => void;
  sections: any[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onSubmitTest?: () => void;
  reviewMode?: boolean;
  revealAnswers?: boolean;
  isLast?: boolean;
  hideBottomNav?: boolean;
  hideTimer?: boolean;
}

const WritingPart2Social = ({
  data, answer, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, onPrevious, sections,
  isBookmarked = false, onToggleBookmark, onSubmitTest, reviewMode, revealAnswers, isLast = true,
  hideBottomNav = false, hideTimer = false,
}: Props) => {
  const showSample = !!revealAnswers && !submitted;
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <div className={`flex flex-col ${reviewMode ? "" : "min-h-[70vh] pb-20"}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 2</p>
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

      <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{data.instruction}</p>
      <p className="text-sm text-foreground mb-4">{data.question}</p>

      <textarea
        value={answer}
        disabled={submitted}
        placeholder="Type your answer here"
        onChange={(e) => onAnswerChange(e.target.value)}
        className="min-h-[120px] w-full rounded-md border border-border bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground whitespace-pre-wrap resize-y disabled:opacity-70 disabled:cursor-not-allowed"
      />

      <div className="flex justify-end mt-1.5">
        <span className="text-xs text-muted-foreground">
          Words <span className="font-semibold text-foreground">{wordCount}</span> / {data.wordLimit}
        </span>
      </div>

      {showSample && data.sampleAnswer && (
        <div className="mt-4 bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#24085a]">
          <p className="text-xs font-bold text-[#24085a] uppercase tracking-wide mb-2">
            💡 Bài viết mẫu
          </p>
          <p className="text-sm text-foreground font-medium whitespace-pre-line leading-relaxed">{data.sampleAnswer}</p>
        </div>
      )}

      {!reviewMode && <BottomNavBar isFirst={!onPrevious} isLast={isLast} onNext={!submitted ? onSubmit : undefined} onSubmit={!submitted ? onSubmit : undefined} onPrevious={onPrevious} sections={sections} onSubmitTest={onSubmitTest} />}
    </div>
  );
};

export default WritingPart2Social;
