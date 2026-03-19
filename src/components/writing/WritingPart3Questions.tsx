import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/writing/WordCounter";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart3Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart3Data;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  sections: any[];
}

const WritingPart3Questions = ({
  data, answers, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, sections,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 3</p>
          <p className="text-sm text-muted-foreground max-w-lg">{data.instruction}</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <div className="flex-1 space-y-5">
        {data.questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-sm font-medium text-foreground mb-3">
              {i + 1}. {q.text}
            </p>
            <Textarea
              value={answers[i] || ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              placeholder="Write your answer here (30-40 words)..."
              disabled={submitted}
              className="min-h-[100px] text-sm resize-none"
            />
            <div className="mt-2">
              <WordCounter text={answers[i] || ""} limit={data.wordLimit} />
            </div>
            {submitted && (
              <div className="mt-3 bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  💡 Đáp án mẫu: <span className="text-foreground">{q.sampleAnswer}</span>
                </p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

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

export default WritingPart3Questions;
