import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Eye } from "lucide-react";
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

      {/* Detailed review */}
      <div className="space-y-4">
        {questions.map((q, i) => {
          const isFill = q.question_type === "fill-in-blank";
          let userCorrect: boolean;
          let userAnswer: string;

          if (isFill) {
            const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
            userCorrect = fillAnswers[i]?.toLowerCase().trim() === correctText;
            userAnswer = fillAnswers[i] || "(không trả lời)";
          } else {
            userCorrect = answers[i] === q.correct_answer;
            userAnswer =
              answers[i] !== null
                ? q.options[answers[i]!]
                : "(không trả lời)";
          }

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-card border rounded-xl p-5 ${
                userCorrect ? "border-success/30" : "border-destructive/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {userCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-2">
                    <span className="text-muted-foreground">Câu {i + 1}:</span>{" "}
                    {q.question_text}
                  </p>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Bạn chọn:</span>{" "}
                      <span
                        className={
                          userCorrect
                            ? "text-success font-medium"
                            : "text-destructive font-medium"
                        }
                      >
                        {userAnswer}
                      </span>
                    </p>
                    {!userCorrect && (
                      <p>
                        <span className="text-muted-foreground">
                          Đáp án đúng:
                        </span>{" "}
                        <span className="text-success font-medium">
                          {q.options[q.correct_answer]}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default GrammarResults;
