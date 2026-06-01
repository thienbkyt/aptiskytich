import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamHeader from "@/components/exam/ExamHeader";
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

  // Group consecutive synonym vocab_matching questions into one page
  const groups = useMemo(() => {
    const g: { startIdx: number; indices: number[]; isSynonym: boolean }[] = [];
    let i = 0;
    const isSyn = (q: Question | undefined) =>
      q?.question_type === "vocab_matching" &&
      (q.extra_data as any)?.vocabType === "synonym";
    while (i < questions.length) {
      if (isSyn(questions[i])) {
        const indices = [i];
        let j = i + 1;
        while (j < questions.length && isSyn(questions[j])) {
          indices.push(j);
          j++;
        }
        g.push({ startIdx: i, indices, isSynonym: true });
        i = j;
      } else {
        g.push({ startIdx: i, indices: [i], isSynonym: false });
        i++;
      }
    }
    return g;
  }, [questions]);

  const currentGroupIdx = Math.max(
    0,
    groups.findIndex((g) => g.indices.includes(currentIndex))
  );
  const currentGroup = groups[currentGroupIdx];

  useEffect(() => {
    if (phase === "practice" && currentGroup) {
      setSeenQuestions((prev) => {
        const next = new Set(prev);
        currentGroup.indices.forEach((idx) => next.add(idx));
        return next;
      });
    }
  }, [phase, currentGroupIdx]);

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

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
        <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
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
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="min-h-[70vh] flex flex-col pb-20">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm font-heading font-bold text-gray-900">
                Grammar & Vocabulary
              </p>
              <p className="text-sm text-gray-700">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleBookmark(currentIndex)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  bookmarked.has(currentIndex)
                    ? "border-[#24085a] bg-[#24085a]/10 text-[#24085a]"
                    : "border-gray-300 text-gray-500 hover:border-[#24085a]/30"
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    bookmarked.has(currentIndex) ? "fill-[#24085a]" : ""
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
              <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  {isFillBlank && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600">
                      Fill in the blank
                    </span>
                  )}
                  {!isFillBlank && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#24085a]/10 text-[#24085a]">
                      Multiple Choice
                    </span>
                  )}
                </div>

                <h2 className="text-sm font-heading font-bold text-gray-900 mb-6 leading-relaxed">
                  {q.question_text}
                </h2>

                {/* MCQ Options */}
                {!isFillBlank && (
                  <div className="border border-border rounded-md overflow-hidden bg-background">
                    {q.options.map((opt, i) => {
                      const isLastOpt = i === q.options.length - 1;
                      let cls =
                        "bg-background hover:bg-muted/50 text-foreground";
                      if (submitted) {
                        if (i === q.correct_answer)
                          cls = "bg-emerald-500/10 text-emerald-700";
                        else if (i === selected)
                          cls = "bg-destructive/10 text-destructive";
                        else cls = "bg-background text-muted-foreground";
                      } else if (selected === i) {
                        cls = "bg-muted-foreground/30 text-foreground";
                      }
                      return (
                        <button
                          key={i}
                          onClick={() =>
                            !submitted && handleAnswerSelect(currentIndex, i)
                          }
                          disabled={submitted}
                          className={`w-full flex items-stretch text-left transition-colors ${cls} ${
                            !isLastOpt ? "border-b border-border" : ""
                          }`}
                        >
                          <span className="flex items-center justify-center w-14 shrink-0 bg-muted/60 text-foreground font-heading font-semibold text-lg border-r border-border py-3">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1 px-4 py-3 text-sm flex items-center justify-between">
                            <span>{opt}</span>
                            {submitted && i === q.correct_answer && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                            {submitted &&
                              i === selected &&
                              i !== q.correct_answer && (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                          </span>
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
                            ? "border-green-500 bg-green-50"
                            : "border-red-500 bg-red-50"
                          : ""
                      }`}
                    />
                    {submitted && (
                      <p className="text-sm text-gray-500">
                        Đáp án đúng:{" "}
                        <span className="font-bold text-green-600">
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
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold mb-1 ${
                        qIsCorrect ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {qIsCorrect ? "✓ Chính xác!" : "✗ Sai rồi!"}
                    </p>
                    <p className="text-sm text-gray-600">
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
    </div>
  );
};

export default GrammarExamEngine;
