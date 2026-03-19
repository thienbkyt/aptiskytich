import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/writing/WordCounter";
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
  sections: any[];
}

const WritingPart2Social = ({
  data, answer, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, sections,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 2</p>
          <p className="text-sm text-muted-foreground">{data.instruction}</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      {/* Social media post */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {data.socialPost.author[0]}
          </div>
          <p className="text-sm font-bold text-foreground">{data.socialPost.author}</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{data.socialPost.content}</p>
      </div>

      {/* Prompt */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">In your response:</p>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
          {data.promptQuestions.map((pq, i) => (
            <li key={i}>{pq}</li>
          ))}
        </ul>
      </div>

      {/* Answer textarea */}
      <div className="flex-1">
        <Textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Write your response here..."
          disabled={submitted}
          className="min-h-[120px] text-sm resize-none"
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

export default WritingPart2Social;
