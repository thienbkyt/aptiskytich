import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Question } from "@/data/questions";

interface GrammarResultsProps {
  questions: Question[];
  answers: (number | null)[];
  fillAnswers: string[];
  onExit: () => void;
  onRetry: () => void;
  /** When provided, render a "Xem lại từng câu →" button to review on the practice UI. */
  onReview?: () => void;
}

const GrammarResults = ({
  questions,
  answers,
  fillAnswers,
  onExit,
  onRetry,
  onReview,
}: GrammarResultsProps) => {
  const correct = questions.reduce((acc, q, i) => {
    if (q.question_type === "fill-in-blank") {
      const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
      return acc + (fillAnswers[i]?.toLowerCase().trim() === correctText ? 1 : 0);
    }
    return acc + (answers[i] === q.correct_answer ? 1 : 0);
  }, 0);

  const total = questions.length;
  const pct = Math.round((correct / total) * 100);

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-8 text-center mb-8"
      >
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
          Kết quả Grammar & Vocabulary
        </h2>
        <div className="flex items-center justify-center gap-8 mt-6">
          <div>
            <p className="text-4xl font-heading font-extrabold text-primary">
              {correct}/{total}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Số câu đúng</p>
          </div>
          <div>
            <p className="text-4xl font-heading font-extrabold text-foreground">
              {pct}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">Tỉ lệ đúng</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Button variant="outline" onClick={onExit} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Button>
          {onReview && (
            <Button variant="secondary" onClick={onReview} className="gap-2">
              <Eye className="w-4 h-4" />
              Xem lại từng câu →
            </Button>
          )}
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Làm lại
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default GrammarResults;
