import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamHeader from "@/components/exam/ExamHeader";
import ExamInstructions from "@/components/exam/ExamInstructions";
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

type Page =
  | { kind: "mcq"; index: number }
  | { kind: "fill"; index: number }
  | { kind: "vocab"; vocabType: string; indices: number[] };

const VOCAB_META: Record<
  string,
  { instruction: string; example?: { left: string; sep: string; right: string }; sep: string; layout: "left-sep-right" | "gap-fill" | "left-right" }
> = {
  synonym: {
    instruction:
      "Select a word from each drop-down list on the right that has the same or very similar meaning to each word on the left.",
    example: { left: "big", sep: "=", right: "large" },
    sep: "=",
    layout: "left-sep-right",
  },
  sentence_definition: {
    instruction: "Complete each definition using a word from the drop-down list.",
    sep: "is to",
    layout: "left-sep-right",
  },
  definition_matching: {
    instruction: "Complete each definition using a word from the drop-down list.",
    sep: "",
    layout: "left-right",
  },
  gap_fill: {
    instruction: "Complete each sentence using a word from each drop-down list.",
    sep: "",
    layout: "gap-fill",
  },
  collocation: {
    instruction:
      "Select a word from each drop-down list on the right that is most often used with each word on the left.",
    example: { left: "big", sep: "+", right: "house" },
    sep: "+",
    layout: "left-sep-right",
  },
};

const GrammarExamEngine = ({
  questions,
  testTitle,
  timeLimit,
  onExit,
  onComplete,
  onAnswersChange,
}: GrammarExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [currentPage, setCurrentPage] = useState(0);
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

  // Build pages: group consecutive vocab_matching of same vocabType
  const pages: Page[] = useMemo(() => {
    const result: Page[] = [];
    let i = 0;
    while (i < questions.length) {
      const q = questions[i];
      const vt = q.extra_data?.vocabType;
      if (q.question_type === "vocab_matching" && vt) {
        const indices: number[] = [];
        while (
          i < questions.length &&
          questions[i].question_type === "vocab_matching" &&
          questions[i].extra_data?.vocabType === vt
        ) {
          indices.push(i);
          i++;
        }
        result.push({ kind: "vocab", vocabType: vt, indices });
      } else if (q.question_type === "fill-in-blank") {
        result.push({ kind: "fill", index: i });
        i++;
      } else {
        result.push({ kind: "mcq", index: i });
        i++;
      }
    }
    return result;
  }, [questions]);

  const pageIndexFor = useCallback(
    (qi: number) => {
      for (let p = 0; p < pages.length; p++) {
        const page = pages[p];
        if (page.kind === "vocab") {
          if (page.indices.includes(qi)) return p;
        } else if (page.index === qi) return p;
      }
      return 0;
    },
    [pages]
  );

  useEffect(() => {
    if (phase !== "practice") return;
    const page = pages[currentPage];
    if (!page) return;
    const newSeen = new Set(seenQuestions);
    if (page.kind === "vocab") page.indices.forEach((i) => newSeen.add(i));
    else newSeen.add(page.index);
    setSeenQuestions(newSeen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentPage]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPhase("review");
    setCurrentPage(0);
    const correct = questions.reduce((acc, q, i) => {
      if (q.question_type === "fill-in-blank") {
        const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
        return acc + (fillAnswers[i]?.toLowerCase().trim() === correctText ? 1 : 0);
      }
      return acc + (answers[i] === q.correct_answer ? 1 : 0);
    }, 0);
    onComplete?.(correct, questions.length);
  }, [questions, answers, fillAnswers, onComplete]);

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
  }, [phase, submitted, timeLeft, handleSubmit]);

  const setAnswerFor = (qi: number, ai: number) => {
    if (submitted) return;
    const next = [...answers];
    next[qi] = ai;
    setAnswers(next);
    onAnswersChange?.(next, fillAnswers);
  };

  const setFillFor = (qi: number, value: string) => {
    if (submitted) return;
    const next = [...fillAnswers];
    next[qi] = value;
    setFillAnswers(next);
    onAnswersChange?.(answers, next);
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
    if (q?.question_type === "fill-in-blank") return fillAnswers[qi]?.trim().length > 0;
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
        setCurrentPage(0);
      },
      questions: questions.map((_, qi) => ({
        label: String(qi + 1).padStart(2, "0"),
        seen: seenQuestions.has(qi),
        attempted: isAnswered(qi),
        isCurrent: phase === "practice" && pages[currentPage] && (
          pages[currentPage].kind === "vocab"
            ? (pages[currentPage] as any).indices.includes(qi)
            : (pages[currentPage] as any).index === qi
        ),
        onClick: () => {
          setPhase("practice");
          setCurrentPage(pageIndexFor(qi));
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
            description={`Bài luyện tập: ${testTitle}. Bao gồm câu hỏi trắc nghiệm và từ vựng.`}
          />
        </div>
      </div>
    );
  }

  const page = pages[currentPage];
  if (!page) return null;

  const isLastPage = currentPage === pages.length - 1;
  const isFirstPage = currentPage === 0;

  // Header label
  let headerRange = "";
  if (page.kind === "vocab") {
    const first = page.indices[0] + 1;
    const last = page.indices[page.indices.length - 1] + 1;
    headerRange = `Questions ${first}-${last} of ${questions.length}`;
  } else {
    headerRange = `Question ${page.index + 1} of ${questions.length}`;
  }

  const primaryQi = page.kind === "vocab" ? page.indices[0] : page.index;

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Grammar & Vocabulary" partLabel={testTitle} onExit={onExit} />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        <div className="min-h-[70vh] flex flex-col pb-20">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm font-heading font-bold text-gray-900">Grammar & Vocabulary</p>
              <p className="text-sm text-gray-700">{headerRange}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleBookmark(primaryQi)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  bookmarked.has(primaryQi)
                    ? "border-[#24085a] bg-[#24085a]/10 text-[#24085a]"
                    : "border-gray-300 text-gray-500 hover:border-[#24085a]/30"
                }`}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked.has(primaryQi) ? "fill-[#24085a]" : ""}`} />
                Bookmark
              </button>
              <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {page.kind === "mcq" && (
                <McqPage
                  q={questions[page.index]}
                  qi={page.index}
                  selected={answers[page.index]}
                  submitted={submitted}
                  onSelect={(ai) => setAnswerFor(page.index, ai)}
                />
              )}

              {page.kind === "fill" && (
                <FillPage
                  q={questions[page.index]}
                  value={fillAnswers[page.index] || ""}
                  submitted={submitted}
                  onChange={(v) => setFillFor(page.index, v)}
                />
              )}

              {page.kind === "vocab" && (
                <VocabPage
                  vocabType={page.vocabType}
                  items={page.indices.map((qi) => ({
                    qi,
                    q: questions[qi],
                    selected: answers[qi],
                  }))}
                  submitted={submitted}
                  onSelect={setAnswerFor}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <BottomNavBar
            onPrevious={!isFirstPage ? () => setCurrentPage((p) => p - 1) : undefined}
            onNext={!isLastPage ? () => setCurrentPage((p) => p + 1) : undefined}
            onSubmit={isLastPage && !submitted ? handleSubmit : undefined}
            isFirst={isFirstPage}
            isLast={isLastPage}
            submitLabel="Submit"
            sections={sections}
            bookmarkedCount={bookmarked.size}
          />
        </div>
      </div>
    </div>
  );
};

// ─── MCQ page (table-style, 3 rows) ───────────────────────────
const McqPage = ({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: Question;
  qi: number;
  selected: number | null;
  submitted: boolean;
  onSelect: (ai: number) => void;
}) => {
  const qIsCorrect = submitted && selected === q.correct_answer;
  return (
    <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-sm font-heading font-bold text-gray-900 mb-4 leading-relaxed">
        {q.question_text}
      </h2>

      <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
        {q.options.map((opt, i) => {
          const isLast = i === q.options.length - 1;
          let cls = "bg-white hover:bg-gray-50 text-gray-900";
          if (submitted) {
            if (i === q.correct_answer) cls = "bg-emerald-500/10 text-emerald-700";
            else if (i === selected) cls = "bg-red-500/10 text-red-700";
            else cls = "bg-white text-gray-400";
          } else if (selected === i) {
            cls = "bg-gray-300 text-gray-900";
          }
          return (
            <button
              key={i}
              onClick={() => !submitted && onSelect(i)}
              disabled={submitted}
              className={`w-full flex items-stretch text-left transition-colors ${cls} ${
                !isLast ? "border-b border-gray-300" : ""
              }`}
            >
              <span className="flex items-center justify-center w-14 shrink-0 bg-gray-100 text-gray-800 font-heading font-semibold text-lg border-r border-gray-300 py-3">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 px-4 py-3 text-sm flex items-center justify-between">
                <span>{opt}</span>
                {submitted && i === q.correct_answer && <CheckCircle2 className="w-4 h-4" />}
                {submitted && i === selected && i !== q.correct_answer && (
                  <XCircle className="w-4 h-4" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {submitted && q.explanation && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            qIsCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}
        >
          <p className={`text-sm font-semibold mb-1 ${qIsCorrect ? "text-green-600" : "text-red-600"}`}>
            {qIsCorrect ? "✓ Chính xác!" : "✗ Sai rồi!"}
          </p>
          <p className="text-sm text-gray-600">{q.explanation}</p>
        </div>
      )}
    </div>
  );
};

// ─── Fill-in-blank page ───────────────────────────────────────
const FillPage = ({
  q,
  value,
  submitted,
  onChange,
}: {
  q: Question;
  value: string;
  submitted: boolean;
  onChange: (v: string) => void;
}) => {
  const correctText = q.options[q.correct_answer]?.toLowerCase().trim();
  const ok = value.toLowerCase().trim() === correctText;
  return (
    <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-sm font-heading font-bold text-gray-900 mb-4 leading-relaxed">
        {q.question_text}
      </h2>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nhập đáp án của bạn..."
        disabled={submitted}
        className={`text-base h-12 ${
          submitted ? (ok ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50") : ""
        }`}
      />
      {submitted && (
        <p className="mt-3 text-sm text-gray-500">
          Đáp án đúng:{" "}
          <span className="font-bold text-green-600">{q.options[q.correct_answer]}</span>
        </p>
      )}
    </div>
  );
};

// ─── Vocab page (grouped 5 questions) ─────────────────────────
const VocabPage = ({
  vocabType,
  items,
  submitted,
  onSelect,
}: {
  vocabType: string;
  items: { qi: number; q: Question; selected: number | null }[];
  submitted: boolean;
  onSelect: (qi: number, ai: number) => void;
}) => {
  const meta = VOCAB_META[vocabType] || VOCAB_META.synonym;

  const renderDropdown = (q: Question, qi: number, selected: number | null) => {
    let borderCls = "border-gray-300";
    if (submitted) {
      if (selected === q.correct_answer) borderCls = "border-emerald-500 bg-emerald-50";
      else borderCls = "border-red-500 bg-red-50";
    } else if (selected !== null) {
      borderCls = "border-gray-500";
    }
    return (
      <select
        value={selected ?? ""}
        onChange={(e) => onSelect(qi, parseInt(e.target.value))}
        disabled={submitted}
        className={`min-w-[160px] h-9 px-2 rounded border bg-white text-sm text-gray-900 ${borderCls}`}
      >
        <option value="" disabled>
          — Select —
        </option>
        {q.options.map((opt, i) => (
          <option key={i} value={i}>
            {opt}
          </option>
        ))}
      </select>
    );
  };

  const renderRow = (q: Question, qi: number, selected: number | null) => {
    const ok = submitted && selected === q.correct_answer;
    if (meta.layout === "gap-fill") {
      // split on _____
      const parts = q.question_text.split(/_{2,}/);
      const before = parts[0] || "";
      const after = parts.slice(1).join("_____") || "";
      return (
        <div
          key={qi}
          className="flex items-center gap-2 flex-wrap py-3 border-b border-gray-200 last:border-b-0"
        >
          <span className="text-sm text-gray-900">{before}</span>
          {renderDropdown(q, qi, selected)}
          <span className="text-sm text-gray-900">{after}</span>
          {submitted && (
            <span className="ml-auto text-xs text-gray-500">
              Đáp án:{" "}
              <span className={ok ? "text-emerald-700 font-semibold" : "text-emerald-700 font-semibold"}>
                {q.options[q.correct_answer]}
              </span>
            </span>
          )}
        </div>
      );
    }

    if (meta.layout === "left-right") {
      return (
        <div
          key={qi}
          className="flex items-start gap-3 py-3 border-b border-gray-200 last:border-b-0"
        >
          <p className="flex-1 text-sm text-gray-900 leading-relaxed">{q.question_text}</p>
          <div className="shrink-0">{renderDropdown(q, qi, selected)}</div>
          {submitted && (
            <span className="text-xs text-gray-500 self-center">
              <span className="text-emerald-700 font-semibold">
                {q.options[q.correct_answer]}
              </span>
            </span>
          )}
        </div>
      );
    }

    // left-sep-right
    return (
      <div
        key={qi}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 border-b border-gray-200 last:border-b-0"
      >
        <span className="text-sm text-gray-900 font-medium">{q.question_text}</span>
        <span className="text-sm text-gray-500">{meta.sep}</span>
        <div className="flex items-center gap-3">
          {renderDropdown(q, qi, selected)}
          {submitted && (
            <span className="text-xs text-gray-500">
              <span className="text-emerald-700 font-semibold">
                {q.options[q.correct_answer]}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <p className="text-sm text-gray-700 mb-4 leading-relaxed">{meta.instruction}</p>

      {meta.example && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 mb-2 text-gray-400 italic border-b border-dashed border-gray-200">
          <span className="text-sm">{meta.example.left}</span>
          <span className="text-sm">{meta.example.sep}</span>
          <span className="text-sm">{meta.example.right}</span>
        </div>
      )}

      <div>{items.map((it) => renderRow(it.q, it.qi, it.selected))}</div>
    </div>
  );
};

export default GrammarExamEngine;
