import { Bookmark } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import RichTextEditor from "@/components/writing/RichTextEditor";
import type { WritingPart4Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart4Data;
  informalAnswer: string;
  formalAnswer: string;
  onInformalChange: (value: string) => void;
  onFormalChange: (value: string) => void;
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
}

const WritingPart4TwoEmails = ({
  data, informalAnswer, formalAnswer,
  onInformalChange, onFormalChange,
  timeLeft, totalTime, submitted, onSubmit, onPrevious, sections,
  isBookmarked = false, onToggleBookmark, onSubmitTest, reviewMode,
}: Props) => {
  return (
    <div className={`flex flex-col ${reviewMode ? "" : "min-h-[70vh] pb-20"}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 4</p>
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

      {/* Scenario intro + email */}
      <div className="mb-8">
        <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{data.scenarioIntro}</p>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{data.scenarioEmail}</p>
        </div>
      </div>

      {/* Informal Email */}
      <div className="mb-8">
        <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{data.informalEmail.instruction}</p>
        <RichTextEditor
          onTextChange={onInformalChange}
          disabled={submitted}
          placeholder="Type your answer here"
          minHeight="140px"
          wordLimit={data.informalEmail.wordLimit}
          initialValue={informalAnswer}
        />
        {submitted && data.informalEmail.sampleAnswer && (
          <div className="bg-muted/50 rounded-xl p-4 mt-3 text-sm">
            <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.informalEmail.sampleAnswer}</p>
          </div>
        )}
      </div>

      {/* Formal Email */}
      <div className="mb-4">
        <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{data.formalEmail.instruction}</p>
        <RichTextEditor
          onTextChange={onFormalChange}
          disabled={submitted}
          placeholder="Type your answer here"
          minHeight="220px"
          wordLimit={data.formalEmail.wordLimit}
          initialValue={formalAnswer}
        />
        {submitted && data.formalEmail.sampleAnswer && (
          <div className="bg-muted/50 rounded-xl p-4 mt-3 text-sm">
            <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.formalEmail.sampleAnswer}</p>
          </div>
        )}
      </div>

      {!reviewMode && <BottomNavBar isFirst={!onPrevious} isLast={false} onNext={!submitted ? onSubmit : undefined} onPrevious={onPrevious} sections={sections} onSubmitTest={onSubmitTest} />}
    </div>
  );
};

export default WritingPart4TwoEmails;
