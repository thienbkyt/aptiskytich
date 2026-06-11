import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import RichTextEditor from "@/components/writing/RichTextEditor";
import type { WritingPart3Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart3Data;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  onPrevious?: () => void;
  sections: any[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onSubmitTest?: () => void;
}

const WritingPart3Questions = ({
  data, answers, onAnswerChange, timeLeft, totalTime,
  submitted, onSubmit, onPrevious, sections,
  isBookmarked = false, onToggleBookmark, onSubmitTest,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 3</p>
          <p className="text-sm max-w-lg text-secondary-foreground font-bold">{data.instruction}</p>
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
            <RichTextEditor
              onTextChange={(val) => onAnswerChange(i, val)}
              disabled={submitted}
              placeholder="Write your answer here (30-40 words)..."
              minHeight="100px"
              wordLimit={data.wordLimit}
              initialValue={answers[i] || ""}
            />
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

      <BottomNavBar isFirst={!onPrevious} isLast={false} onNext={!submitted ? onSubmit : undefined} onPrevious={onPrevious} sections={sections} onSubmitTest={onSubmitTest} />
    </div>
  );
};

export default WritingPart3Questions;
