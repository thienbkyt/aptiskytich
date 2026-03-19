import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { WritingPart1Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart1Data;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  sections: any[];
}

const WritingPart1Short = ({
  data, answers, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, sections,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 1</p>
          <p className="text-sm text-muted-foreground">{data.instruction}</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <div className="flex-1 space-y-4">
        {data.questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-sm font-medium text-foreground mb-3">
              {i + 1}. {q.text}
            </p>
            <Input
              value={answers[i] || ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              placeholder="Type your answer..."
              disabled={submitted}
              className="text-sm"
              maxLength={50}
            />
            {submitted && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 Đáp án mẫu: <span className="text-success font-medium">{q.sampleAnswer}</span>
              </p>
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

export default WritingPart1Short;
