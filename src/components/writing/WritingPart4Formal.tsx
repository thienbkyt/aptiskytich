import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/writing/WordCounter";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart4Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart4Data;
  answer: string;
  onAnswerChange: (value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  sections: any[];
}

const WritingPart4Formal = ({
  data, answer, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, sections,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 4</p>
          <p className="text-sm text-muted-foreground max-w-lg">{data.instruction}</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      {/* Scenario */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <p className="text-sm text-foreground leading-relaxed">{data.scenario}</p>
      </div>

      {/* Bullet points */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Include the following:</p>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
          {data.bulletPoints.map((bp, i) => (
            <li key={i}>{bp}</li>
          ))}
        </ul>
      </div>

      {/* Textarea */}
      <div className="flex-1">
        <Textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Write your formal email here..."
          disabled={submitted}
          className="min-h-[220px] text-sm resize-none"
        />
        <div className="mt-2">
          <WordCounter text={answer} limit={data.wordLimit} />
        </div>
      </div>

      {submitted && (
        <div className="bg-muted/50 rounded-xl p-4 mt-4 text-sm">
          <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
          <p className="text-muted-foreground whitespace-pre-line">{data.sampleAnswer}</p>
        </div>
      )}

      <BottomNavBar
        isFirst={true}
        isLast={true}
        onSubmit={!submitted ? onSubmit : undefined}
        submitLabel="Submit"
        sections={sections}
      />
    </div>
  );
};

export default WritingPart4Formal;
