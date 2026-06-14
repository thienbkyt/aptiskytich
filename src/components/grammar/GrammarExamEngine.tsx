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
import GrammarResults from "@/components/grammar/GrammarResults";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import type { QuestionItem } from "@/components/reading/BottomNavBar";
import type { Question } from "@/data/questions";
import { setCoachExamContext } from "@/stores/coachStore";

interface GrammarExamEngineProps {
  questions: Question[];
  testTitle: string;
  timeLimit: number;
  onExit: () => void;
  onComplete?: (
    correct: number,
    total: number,
    perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }>
  ) => void;
  onAnswersChange?: (answers: (number | null)[], fillAnswers: string[]) => void;
  onPreviousPart?: () => void;
  skipIntro?: boolean;
  /** When true (default), render GrammarResults after submission instead of the locked review UI. */
  showResultsOnSubmit?: boolean;
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  initialAnswers?: (number | null)[];
  initialFillAnswers?: string[];
}

type Phase = "instructions" | "grammar_intro" | "practice" | "review";

const GrammarExamEngine = ({
  questions,
  testTitle,
  timeLimit,
  onExit,
  onComplete,
  onAnswersChange,
  onPreviousPart,
  skipIntro,
  showResultsOnSubmit = true,
  reviewMode,
  initialAnswers,
  initialFillAnswers,
}: GrammarExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode) ? "practice" : "instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    reviewMode && initialAnswers ? initialAnswers : new Array(questions.length).fill(null)
  );
  const [fillAnswers, setFillAnswers] = useState<string[]>(
    reviewMode && initialFillAnswers ? initialFillAnswers : new Array(questions.length).fill("")
  );
  const [submitted, setSubmitted] = useState(!!reviewMode);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [isReviewing, setIsReviewing] = useState(false);

  // Group consecutive vocab_matching questions of same groupable vocabType into one page
  const GROUPABLE_VOCAB_TYPES = ["synonym", "sentence_definition", "gap_fill", "definition_matching", "collocation"] as const;
  const groups = useMemo(() => {
    const g: {
      startIdx: number;
      indices: number[];
      isSynonym: boolean;
      vocabType?: string;
    }[] = [];
    let i = 0;
    const getGroupType = (q: Question | undefined): string | null => {
      if (q?.question_type !== "vocab_matching") return null;
      const vt = (q.extra_data as any)?.vocabType;
      return (GROUPABLE_VOCAB_TYPES as readonly string[]).includes(vt) ? vt : null;
    };
    while (i < questions.length) {
      const vt = getGroupType(questions[i]);
      if (vt) {
        const indices = [i];
        let j = i + 1;
        while (j < questions.length && getGroupType(questions[j]) === vt) {
          indices.push(j);
          j++;
        }
        g.push({ startIdx: i, indices, isSynonym: true, vocabType: vt });
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

  // Push current question to AI Coach context (for "explain this question" feature)
  useEffect(() => {
    if (phase !== "practice" && phase !== "review") {
      setCoachExamContext(null);
      return;
    }
    const q = questions[currentIndex];
    if (!q) return;
    const userIdx = answers[currentIndex];
    const userAns = q.options && userIdx != null ? q.options[userIdx] : (fillAnswers[currentIndex] || null);
    const correctAns = q.options && q.correct_answer != null ? q.options[q.correct_answer] : null;
    setCoachExamContext({
      skill: "Grammar & Vocabulary",
      part: testTitle,
      questionIndex: currentIndex,
      totalQuestions: questions.length,
      questionText: q.question_text,
      options: q.options,
      userAnswer: userAns,
      correctAnswer: correctAns,
      explanation: q.explanation,
      isSubmitted: submitted,
    });
  }, [phase, currentIndex, answers, fillAnswers, submitted, questions, testTitle]);

  useEffect(() => () => { setCoachExamContext(null); }, []);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPhase("review");
    setCurrentIndex(0);
    let correct = 0;
    const perQuestion = questions.map((q, i) => {
      let ok = false;
      let userAnswer: string | null = null;
      if (q.question_type === "fill-in-blank") {
        const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
        userAnswer = fillAnswers[i] ?? null;
        ok = (fillAnswers[i]?.toLowerCase().trim() ?? "") === correctText;
      } else {
        userAnswer = answers[i] !== null ? String(answers[i]) : null;
        ok = answers[i] === q.correct_answer;
      }
      if (ok) correct++;
      return { exam_question_id: (q as any).id, user_answer: userAnswer, is_correct: ok };
    });
    onComplete?.(correct, questions.length, perQuestion);
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
      const v = fillAnswers[qi];
      return typeof v === "string" && v.trim().length > 0;
    }
    const v = answers[qi];
    return v !== null && v !== undefined;
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
        bookmarked: bookmarked.has(qi),
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
      <div className="min-h-screen bg-white flex flex-col">
        {!reviewMode && !submitted && (
          <AdminExamControls
            label="Grammar · Hướng dẫn"
            onSkip={() => setPhase("grammar_intro")}
            onBack={onPreviousPart}
          />
        )}
        <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
        <div className="flex-1 w-full pb-20">
          <ExamInstructions
            skillName="Grammar & Vocabulary"
            timeLeft={timeLeft}
            totalTime={timeLimit}
            totalParts={questions.length}
            totalMinutes={Math.ceil(timeLimit / 60)}
            onStart={() => setPhase("grammar_intro")}
            sections={sections}
            description={testTitle}
          />
        </div>
      </div>
    );
  }

  if (phase === "grammar_intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {!reviewMode && !submitted && (
          <AdminExamControls
            label="Grammar · Bắt đầu"
            onSkip={() => setPhase("practice")}
            onBack={() => setPhase("instructions")}
          />
        )}
        <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
        <div className="flex-1 pl-[80px] pt-[40px] font-sans text-black">
          <h1 className="text-xl mb-6">Aptis General Grammar & Vocabulary Instructions</h1>
          <p className="font-bold mb-2">Grammar & Vocabulary</p>
          <p className="mb-2">The test has {questions.length} questions.</p>
          <p className="mb-2">You have {Math.ceil(timeLimit / 60)} minutes to complete the test.</p>
          <div className="h-6" />
          <p>When you click on the &apos;Next&apos; button, the test will begin.</p>
        </div>
        <BottomNavBar
          isFirst={false}
          onNext={() => setPhase("practice")}
          onPrevious={() => setPhase("instructions")}
          sections={sections}
          isInstructionsPhase
          onProceedFromInstructions={() => setPhase("practice")}
        />
      </div>
    );
  }

  if (phase === "review" && showResultsOnSubmit && !isReviewing) {
    const handleRetry = () => {
      setAnswers(new Array(questions.length).fill(null));
      setFillAnswers(new Array(questions.length).fill(""));
      setSubmitted(false);
      setPhase("practice");
      setCurrentIndex(0);
      setTimeLeft(timeLimit);
      setSeenQuestions(new Set());
      setBookmarked(new Set());
      setIsReviewing(false);
    };
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
        <main className="flex-1 py-10 px-4">
          <GrammarResults
            questions={questions}
            answers={answers}
            fillAnswers={fillAnswers}
            onExit={onExit}
            onRetry={handleRetry}
            onReview={() => { setIsReviewing(true); setCurrentIndex(0); }}
          />
        </main>
      </div>
    );
  }

  const q = questions[currentIndex];
  if (!q) return null;

  const selected = answers[currentIndex];
  const isFillBlank = q.question_type === "fill-in-blank";
  const isSynonymGroup = !!currentGroup?.isSynonym;
  const qIsCorrect = submitted && isCorrect(currentIndex);
  const qIsWrong = submitted && isAnswered(currentIndex) && !isCorrect(currentIndex);

  const groupStartLabel = currentGroup
    ? currentGroup.indices[0] + 1
    : currentIndex + 1;
  const groupEndLabel = currentGroup
    ? currentGroup.indices[currentGroup.indices.length - 1] + 1
    : currentIndex + 1;

  const goPrevGroup = () => {
    if (currentGroupIdx > 0) setCurrentIndex(groups[currentGroupIdx - 1].startIdx);
  };
  const goNextGroup = () => {
    if (currentGroupIdx < groups.length - 1)
      setCurrentIndex(groups[currentGroupIdx + 1].startIdx);
  };
  const isFirstGroup = currentGroupIdx === 0;
  const isLastGroup = currentGroupIdx === groups.length - 1;

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      {phase === "practice" && !submitted && (
        <AdminExamControls
          label={`Grammar · Câu ${groupStartLabel}/${questions.length}`}
          onSkip={!isLastGroup ? goNextGroup : handleSubmit}
          onBack={!isFirstGroup ? goPrevGroup : onPreviousPart}
        />
      )}
      <ExamHeader
        skillLabel="Grammar & Vocabulary"
        partLabel={testTitle}
        onExit={onExit}
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="min-h-[70vh] flex flex-col pb-20">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm font-heading font-bold text-gray-900">
                Grammar & Vocabulary
              </p>
              <p className="text-sm text-gray-700">
                {`Question ${isSynonymGroup ? groupStartLabel : currentIndex + 1} of 30`}
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
              key={isSynonymGroup ? `group-${currentGroupIdx}` : `q-${currentIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {isSynonymGroup ? (() => {
                const gType = currentGroup.vocabType || "synonym";
                const isDefinition = gType === "sentence_definition";
                const isDefinitionMatching = gType === "definition_matching";
                const isGapFill = gType === "gap_fill";
                const isCollocation = gType === "collocation";
                const isAnyDefinition = isDefinition || isDefinitionMatching;
                const badge = isGapFill
                  ? "Sentence Gap Fill"
                  : isDefinitionMatching
                  ? "Definition Matching"
                  : isDefinition
                  ? "Definition Completion"
                  : isCollocation
                  ? "Collocation Matching"
                  : "Synonym Matching";
                const instruction = isGapFill
                  ? "Complete each sentence using a word from each drop-down list."
                  : isAnyDefinition
                  ? "Complete each definition using a word from the drop-down list."
                  : isCollocation
                  ? "Select a word from each drop-down list on the right that is most often used with each word on the left."
                  : "Select a word from each drop-down list on the right that has the same or very similar meaning to each word on the left.";
                const separator = isDefinition ? "is to" : isCollocation ? "+" : "=";
                return (
                <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#24085a]/10 text-[#24085a]">
                      {badge}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mb-5 leading-relaxed">
                    {instruction}
                  </p>

                  {/* Example row (muted, non-interactive) — only for synonym and collocation */}
                  {(gType === "synonym" || gType === "collocation") && (
                    <>
                      <div className="flex items-center gap-3 mb-2 opacity-60">
                        <div className="w-24 text-xs text-gray-500">Example</div>
                        <div className="flex-1 flex items-center gap-3">
                          <div className={`w-32 px-3 py-2 rounded border border-gray-200 bg-gray-50 text-sm text-gray-700`}>
                            big
                          </div>
                          <span className="text-gray-500 whitespace-nowrap">{separator}</span>
                          <div className="w-40 px-3 py-2 rounded border border-gray-200 bg-gray-50 text-sm text-gray-700">
                            {isCollocation ? "house" : "large"}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-border my-4" />
                    </>
                  )}

                  {/* Matching rows */}
                  <div className="space-y-3">
                    {currentGroup.indices.map((idx) => {
                      const item = questions[idx];
                      const opts = item.options || [];
                      const labels =
                        (item.extra_data as any)?.optionLabels ||
                        ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
                      const userAns = answers[idx];
                      const itemCorrect = submitted && userAns === item.correct_answer;
                      const itemWrong =
                        submitted && userAns !== null && userAns !== item.correct_answer;

                      let triggerCls = "";
                      if (itemCorrect)
                        triggerCls = "border-emerald-500 bg-emerald-500/10 text-emerald-700";
                      else if (itemWrong)
                        triggerCls = "border-destructive bg-destructive/10 text-destructive";

                      // Split sentence at the first ____ run for gap_fill
                      const gapMatch = isGapFill
                        ? item.question_text.match(/^([\s\S]*?)_{3,}([\s\S]*)$/)
                        : null;
                      const beforeGap = gapMatch ? gapMatch[1].trim() : item.question_text;
                      const afterGap = gapMatch ? gapMatch[2].trim() : "";

                      return (
                        <div key={idx} className="flex items-center gap-3">
                          {isGapFill ? (
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-900">{beforeGap}</span>
                              <div className="w-56">
                                <Select
                                  value={userAns !== null ? String(userAns) : undefined}
                                  onValueChange={(v) =>
                                    handleAnswerSelect(idx, parseInt(v, 10))
                                  }
                                  disabled={submitted}
                                >
                                  <SelectTrigger className={`h-10 ${triggerCls}`}>
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {opts.map((opt, oi) => (
                                      <SelectItem key={oi} value={String(oi)}>
                                        {labels[oi]}. {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {afterGap && (
                                <span className="text-sm text-gray-900">{afterGap}</span>
                              )}
                              {submitted && itemWrong && (
                                <span className="text-xs text-emerald-700">
                                  ✓ {opts[item.correct_answer]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center gap-3">
                              <div className={`${isAnyDefinition ? "flex-1" : "w-40"} px-3 py-2 rounded border border-gray-300 bg-white text-sm font-medium text-gray-900`}>
                                {item.question_text}
                              </div>
                              {!isDefinitionMatching && (
                                <span className="text-gray-500 whitespace-nowrap">{separator}</span>
                              )}
                              <div className="w-56">
                                <Select
                                  value={userAns !== null ? String(userAns) : undefined}
                                  onValueChange={(v) =>
                                    handleAnswerSelect(idx, parseInt(v, 10))
                                  }
                                  disabled={submitted}
                                >
                                  <SelectTrigger className={`h-10 ${triggerCls}`}>
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {opts.map((opt, oi) => (
                                      <SelectItem key={oi} value={String(oi)}>
                                        {labels[oi]}. {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {submitted && itemWrong && (
                                <span className="text-xs text-emerald-700">
                                  ✓ {opts[item.correct_answer]}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })() : (
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
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom nav */}
          <BottomNavBar
            onPrevious={!isFirstGroup ? goPrevGroup : () => setPhase("grammar_intro")}
            onNext={
              !isLastGroup
                ? goNextGroup
                : !submitted
                ? handleSubmit
                : undefined
            }
            onSubmit={undefined}
            isFirst={false}
            isLast={false}
            sections={sections}
            bookmarkedCount={bookmarked.size}
            onSubmitTest={!submitted ? handleSubmit : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default GrammarExamEngine;
