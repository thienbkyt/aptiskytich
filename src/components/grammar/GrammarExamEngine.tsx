import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamInstructions from "@/components/exam/ExamInstructions";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import type { Question } from "@/data/questions";

interface GrammarExamEngineProps {
  questions: Question[];
  testTitle: string;
  timeLimit: number;
  onExit: () => void;
  onComplete?: (correct: number, total: number) => void;
  onAnswersChange?: (answers: (number | null)[], fillAnswers: string[]) => void;
}

type Phase = "instructions" | "practice" | "review";

const GrammarExamEngine = ({
  questions,
  testTitle,
  timeLimit,
  onExit,
  onComplete,
  onAnswersChange,
}: GrammarExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(questions.length).fill(null)
  );
  const [fillAnswers, setFillAnswers] = useState<string[]>(
    new Array(questions.length).fill("")
  );
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());

  // Mark current as seen
  useEffect(() => {
    if (phase === "practice") {
      setSeenQuestions((prev) => new Set(prev).add(currentIndex));
    }
  }, [phase, currentIndex]);

  // Timer
  useEffect(() => {
    if (phase !== "practice" || submitted || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(t);
          handleSubmit();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, submitted, timeLeft]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPhase("review");
    setCurrentIndex(0);
    const correct = questions.reduce((acc, q, i) => {
      if (q.question_type === "fill-in-blank") {
        // For fill-in-blank, compare text answer with the correct option
        const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
        return acc + (fillAnswers[i]?.toLowerCase().trim() === correctText ? 1 : 0);
      }
      return acc + (answers[i] === q.correct_answer ? 1 : 0);
    }, 0);
    onComplete?.(correct, questions.length);
  }, [questions, answers, fillAnswers, onComplete]);

  const handleAnswerSelect = (qi: number, ai: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[qi] = ai;
    setAnswers(newAnswers);
    onAnswersChange?.(newAnswers, fillAnswers);
  };

  const handleFillAnswer = (qi: number, value: string) => {
    if (submitted) return;
    const newFill = [...fillAnswers];
    newFill[qi] = value;
    setFillAnswers(newFill);
    onAnswersChange?.(answers, newFill);
  };

  const toggleBookmark = (qi: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(qi)) next.delete(qi);
      else next.add(qi);
      return next;
    });
  };

  const isAnswered = (qi: number) => {
    const q = questions[qi];
    if (q?.question_type === "fill-in-blank") {
      return fillAnswers[qi]?.trim().length > 0;
    }
    return answers[qi] !== null;
  };

  const isCorrect = (qi: number) => {
    const q = questions[qi];
    if (q?.question_type === "fill-in-blank") {
      const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
      return fillAnswers[qi]?.toLowerCase().trim() === correctText;
    }
    return answers[qi] === q?.correct_answer;
  };

  // Build sections for question list panel
  const sections = [
    {
      title: `Aptis General Grammar & Vocabulary Instructions`,
      isCurrent: phase === "instructions",
      onClick: () => setPhase("instructions"),
    },
    {
      title: testTitle,
      questionCount: questions.length,
      isCurrent: phase !== "instructions",
      onClick: () => {
        setPhase("practice");
        setCurrentIndex(0);
      },
      questions: questions.map((_, qi) => ({
        label: String(qi + 1).padStart(2, "0"),
        seen: seenQuestions.has(qi),
        attempted: isAnswered(qi),
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => {
          setPhase("practice");
          setCurrentIndex(qi);
        },
      })),
    },
  ];

  // Instructions phase
  if (phase === "instructions") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button
            onClick={onExit}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>
        <ExamInstructions
          skillName="Grammar & Vocabulary"
          timeLeft={timeLeft}
          totalTime={timeLimit}
          totalParts={questions.length}
          totalMinutes={Math.ceil(timeLimit / 60)}
          onStart={() => setPhase("practice")}
          sections={sections}
          description={`Bài luyện tập: ${testTitle}. Bao gồm câu hỏi trắc nghiệm và điền từ.`}
        />
      </div>
    );
  }

  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];
  const isFillBlank = q.question_type === "fill-in-blank";
  const qIsCorrect = submitted && isCorrect(currentIndex);
  const qIsWrong = submitted && isAnswered(currentIndex) && !isCorrect(currentIndex);

  return (
    <div className="min-h-[70vh]">
      <div className="flex items-center mb-6">
        <button
          onClick={onExit}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
      </div>

      <div className="min-h-[70vh] flex flex-col pb-20">
        {/* Top bar */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-heading font-bold text-foreground">
              Grammar & Vocabulary
            </p>
            <p className="text-sm text-foreground">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => toggleBookmark(currentIndex)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                bookmarked.has(currentIndex)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  bookmarked.has(currentIndex) ? "fill-primary" : ""
                }`}
              />
              Bookmark
            </button>
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1"
          >
            <div className="bg-background rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-2">
                {isFillBlank && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    Fill in the blank
                  </span>
                )}
                {!isFillBlank && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Multiple Choice
                  </span>
                )}
              </div>

              <h2 className="text-sm font-heading font-bold text-foreground mb-6 leading-relaxed">
                {q.question_text}
              </h2>

              {/* MCQ Options */}
              {!isFillBlank && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    let cls =
                      "border-border hover:border-primary/30 text-foreground hover:bg-muted/50";
                    if (submitted) {
                      if (i === q.correct_answer)
                        cls = "border-success bg-success/10 text-success";
                      else if (i === selected)
                        cls =
                          "border-destructive bg-destructive/10 text-destructive";
                      else cls = "border-border text-muted-foreground";
                    } else if (selected === i) {
                      cls = "border-accent bg-accent/15 text-accent-foreground ring-2 ring-accent";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          !submitted && handleAnswerSelect(currentIndex, i)
                        }
                        disabled={submitted}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${cls}`}
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                        {submitted && i === q.correct_answer && (
                          <CheckCircle2 className="w-4 h-4 inline ml-2" />
                        )}
                        {submitted &&
                          i === selected &&
                          i !== q.correct_answer && (
                            <XCircle className="w-4 h-4 inline ml-2" />
                          )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Fill in the blank */}
              {isFillBlank && (
                <div className="space-y-4">
                  <Input
                    value={fillAnswers[currentIndex] || ""}
                    onChange={(e) =>
                      handleFillAnswer(currentIndex, e.target.value)
                    }
                    placeholder="Nhập đáp án của bạn..."
                    disabled={submitted}
                    className={`text-base h-12 ${
                      submitted
                        ? isCorrect(currentIndex)
                          ? "border-success bg-success/5"
                          : "border-destructive bg-destructive/5"
                        : ""
                    }`}
                  />
                  {submitted && (
                    <p className="text-sm text-muted-foreground">
                      Đáp án đúng:{" "}
                      <span className="font-bold text-success">
                        {q.options[q.correct_answer]}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Explanation */}
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className={`mt-4 p-4 rounded-lg ${
                    qIsCorrect
                      ? "bg-success/10 border border-success/20"
                      : "bg-destructive/10 border border-destructive/20"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold mb-1 ${
                      qIsCorrect ? "text-success" : "text-destructive"
                    }`}
                  >
                    {qIsCorrect ? "✓ Chính xác!" : "✗ Sai rồi!"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {q.explanation}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom nav */}
        <BottomNavBar
          onPrevious={
            currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : undefined
          }
          onNext={
            currentIndex < questions.length - 1
              ? () => setCurrentIndex((p) => p + 1)
              : undefined
          }
          onSubmit={
            currentIndex === questions.length - 1 && !submitted
              ? handleSubmit
              : undefined
          }
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
          submitLabel="Submit"
          sections={sections}
          bookmarkedCount={bookmarked.size}
        />
      </div>
    </div>
  );
};

export default GrammarExamEngine;
