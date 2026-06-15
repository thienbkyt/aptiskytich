import { useState, useEffect, useCallback, useMemo } from "react";
import ExamHeader from "@/components/exam/ExamHeader";
import ExamInstructions from "@/components/exam/ExamInstructions";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ReadingPart1Sentence from "@/components/reading/ReadingPart1Sentence";
import ReadingPart2Cohesion from "@/components/reading/ReadingPart2Cohesion";
import ReadingPart3Opinion from "@/components/reading/ReadingPart3Opinion";
import ReadingPart4Long from "@/components/reading/ReadingPart4Long";
import ReadingResults from "@/components/reading/ReadingResults";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import { TimerProvider } from "@/components/reading/TimerContext";
import TimerDisplay from "@/components/reading/TimerDisplay";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";

export type ReadingPartType = "part1" | "part2" | "part3" | "part4";

export interface ReadingPerQuestion {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

export interface ReadingAnswersState {
  p1: (number | null)[];
  p2: Record<number, string>[];
  p3: (number | null)[];
  p4: (number | null)[];
}

interface ReadingExamEngineProps {
  partType: ReadingPartType;
  testTitle: string;
  timeLimit: number;
  part1Question?: ReadingSentenceQuestion;
  part2Question?: ReadingCohesionQuestion;
  part3Question?: ReadingOpinionQuestion;
  part4Question?: ReadingLongQuestion;
  onExit: () => void;
  onComplete?: (correct: number, total: number, perQuestion?: ReadingPerQuestion[]) => void;
  onPreviousPart?: () => void;
  initialTimeLeft?: number;
  onTimeTick?: (t: number) => void;
  skipIntro?: boolean;
  fullFlow?: boolean;
  /** When true, render ReadingResults after submission instead of the locked review UI. */
  showResultsOnSubmit?: boolean;
  /** DB exam_questions.id for each source row in this part (used to persist per-question results). */
  sourceQuestionIds?: string[];
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  initialAnswers?: {
    p1?: (number | null)[];
    p2?: Record<number, string>[];
    p3?: (number | null)[];
    p4?: (number | null)[];
  };
  /** Notifies parent whenever answers change (skipped in reviewMode). */
  onAnswersChange?: (answers: ReadingAnswersState) => void;
}

type Phase = "instructions" | "reading_intro" | "practice" | "review";

const ReadingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Question, part2Question, part3Question, part4Question,
  onExit, onComplete, onPreviousPart,
  initialTimeLeft, onTimeTick, skipIntro, fullFlow, showResultsOnSubmit = false,
  sourceQuestionIds, reviewMode, initialAnswers, onAnswersChange,
}: ReadingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode) ? "practice" : "instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(!!reviewMode);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft ?? timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [resultStats, setResultStats] = useState<{ correct: number; total: number } | null>(null);
  const [isReviewing, setIsReviewing] = useState(!!reviewMode);
  const [hasStarted, setHasStarted] = useState<boolean>(skipIntro || !!reviewMode);
  useEffect(() => { if (phase === "practice") setHasStarted(true); }, [phase]);

  const [p1Answers, setP1Answers] = useState<(number | null)[]>(
    initialAnswers?.p1 && initialAnswers.p1.length > 0
      ? initialAnswers.p1
      : new Array(part1Question?.gaps.length || 0).fill(null)
  );
  const [p2Placements, setP2Placements] = useState<Record<number, string>[]>(
    () => initialAnswers?.p2 && initialAnswers.p2.length > 0
      ? initialAnswers.p2
      : (part2Question?.sections || []).map(() => ({}))
  );
  const [p3Answers, setP3Answers] = useState<(number | null)[]>(
    initialAnswers?.p3 && initialAnswers.p3.length > 0
      ? initialAnswers.p3
      : new Array(part3Question?.statements.length || 0).fill(null)
  );
  const p4Total = part4Question?.paragraphs?.length || part4Question?.questions.length || 0;
  const [p4Answers, setP4Answers] = useState<(number | null)[]>(
    initialAnswers?.p4 && initialAnswers.p4.length > 0
      ? initialAnswers.p4
      : new Array(p4Total).fill(null)
  );

  // Notify parent of answer changes (skip in reviewMode).
  useEffect(() => {
    if (reviewMode) return;
    onAnswersChange?.({ p1: p1Answers, p2: p2Placements, p3: p3Answers, p4: p4Answers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1Answers, p2Placements, p3Answers, p4Answers]);

  const part2SectionCount = part2Question?.sections.length || 0;

  // Panel "questions": for part2 each section = 1 question; others = per item.
  const totalQuestions = partType === "part1" ? (part1Question?.gaps.length || 0)
    : partType === "part2" ? part2SectionCount
    : partType === "part3" ? (part3Question?.statements.length || 0)
    : p4Total;

  const toggleBookmark = useCallback((qi: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(qi)) next.delete(qi);
      else next.add(qi);
      return next;
    });
  }, []);

  // True only when there is an actual user-supplied value (not null/undefined/empty).
  const isAnswered = (qi: number): boolean => {
    if (partType === "part1") {
      const v = p1Answers[qi];
      return v !== null && v !== undefined;
    }
    if (partType === "part3") {
      const v = p3Answers[qi];
      return v !== null && v !== undefined;
    }
    if (partType === "part4") {
      const v = p4Answers[qi];
      return v !== null && v !== undefined;
    }
    if (partType === "part2") {
      const placements = p2Placements[qi];
      if (!placements) return false;
      return Object.values(placements).some((t) => t != null && t !== "");
    }
    return false;
  };

  // Mark questions as "Seen" whenever the user is viewing the practice screen.
  // Single-page parts (1/3/4) show every question at once, so mark all as seen.
  // Part 2 paginates by section: only the section currently on screen is seen.
  useEffect(() => {
    if (phase !== "practice") return;
    setSeenQuestions((prev) => {
      const next = new Set(prev);
      if (partType === "part2") {
        next.add(currentIndex);
      } else {
        for (let i = 0; i < totalQuestions; i++) next.add(i);
      }
      return next;
    });
  }, [phase, currentIndex, partType, totalQuestions]);

  // When user jumps to a question via the panel, scroll its answer element into view.
  useEffect(() => {
    if (phase !== "practice") return;
    if (partType === "part2") return; // part2 changes section, scroll naturally
    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-question-index="${currentIndex}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [phase, currentIndex, partType]);

  useEffect(() => {
    if (!hasStarted || submitted || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(t);
          handleSubmit();
          onTimeTick?.(0);
          return 0;
        }
        const next = p - 1;
        onTimeTick?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [hasStarted, submitted, timeLeft]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPhase("review");
    setCurrentIndex(0);

    let correct = 0;
    if (partType === "part1" && part1Question) {
      correct = part1Question.gaps.reduce((acc, g, i) => acc + (p1Answers[i] === g.correct ? 1 : 0), 0);
    } else if (partType === "part2" && part2Question) {
      correct = part2Question.sections.reduce((acc, sec, sIdx) => {
        const placements = p2Placements[sIdx] || {};
        return acc + sec.sentences.reduce((a, s) => a + (placements[s.correctPosition] === s.text ? 1 : 0), 0);
      }, 0);
    } else if (partType === "part3" && part3Question) {
      correct = part3Question.statements.reduce((acc, s, i) => acc + (p3Answers[i] === s.correctPerson ? 1 : 0), 0);
    } else if (partType === "part4" && part4Question) {
      if (part4Question.paragraphs && part4Question.headings) {
        // New heading-matching format
        correct = part4Question.paragraphs.reduce((acc, para, pIdx) => {
          const correctHeadingIdx = part4Question.headings!.findIndex(h => h.paragraphIndex === para.index);
          return acc + (p4Answers[pIdx] === correctHeadingIdx ? 1 : 0);
        }, 0);
      } else {
        correct = part4Question.questions.reduce((acc, q, i) => acc + (p4Answers[i] === q.correct ? 1 : 0), 0);
      }
    }
    setResultStats({ correct, total: totalQuestions });
    // Build perQuestion: 1 row per DB source question. Reading parts compress all
    // sub-answers into a single DB row, so we store full answer state as JSON.
    let perQuestion: ReadingPerQuestion[] | undefined;
    if (sourceQuestionIds && sourceQuestionIds.length > 0) {
      const allAnswers =
        partType === "part1" ? p1Answers
        : partType === "part2" ? p2Placements
        : partType === "part3" ? p3Answers
        : p4Answers;
      perQuestion = [{
        exam_question_id: sourceQuestionIds[0],
        user_answer: JSON.stringify({ partType, answers: allAnswers }),
        is_correct: correct === totalQuestions && totalQuestions > 0,
      }];
    }
    onComplete?.(correct, totalQuestions, perQuestion);
  }, [partType, part1Question, part2Question, part3Question, part4Question, p1Answers, p2Placements, p3Answers, p4Answers, totalQuestions, onComplete, sourceQuestionIds]);

  const handleRetry = () => {
    setSubmitted(false);
    setResultStats(null);
    setPhase("practice");
    setCurrentIndex(0);
    setTimeLeft(timeLimit);
    setSeenQuestions(new Set());
    setBookmarked(new Set());
    setP1Answers(new Array(part1Question?.gaps.length || 0).fill(null));
    setP2Placements((part2Question?.sections || []).map(() => ({})));
    setP3Answers(new Array(part3Question?.statements.length || 0).fill(null));
    setP4Answers(new Array(p4Total).fill(null));
  };

  const partLabel = partType === "part1" ? "Part 1 – Gap Fill"
    : partType === "part2" ? "Part 2 – Text Cohesion"
    : partType === "part3" ? "Part 3 – Opinion Matching"
    : "Part 4 – Long Reading";

  const sections = [
    {
      title: "Aptis General Reading Instructions",
      isCurrent: phase === "instructions",
      onClick: () => setPhase("instructions"),
    },
    {
      title: partLabel,
      questionCount: totalQuestions,
      isCurrent: phase !== "instructions",
      onClick: () => { setPhase("practice"); setCurrentIndex(0); },
      questions: Array.from({ length: totalQuestions }, (_, qi) => ({
        label: String(qi + 1).padStart(2, "0"),
        seen: seenQuestions.has(qi),
        attempted: isAnswered(qi),
        bookmarked: bookmarked.has(qi),
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => { setPhase("practice"); setCurrentIndex(qi); },
      })),
    },
  ];

  // Previous on first question: in full-flow (skipIntro) jump to previous part via parent;
  // otherwise go back to the reading_intro screen within the same engine instance.
  // Parent keeps answers per partIndex, so navigating back doesn't lose data.
  const goToPrevPhase = useCallback(() => {
    if (skipIntro && onPreviousPart) onPreviousPart();
    else setPhase("reading_intro");
  }, [skipIntro, onPreviousPart]);

  const goPrevQuestion = useCallback(() => setCurrentIndex((p) => Math.max(0, p - 1)), []);
  const goNextQuestion = useCallback(() => setCurrentIndex((p) => p + 1), []);

  const navProps = useMemo(() => ({
    onPrevious: currentIndex > 0 ? goPrevQuestion : goToPrevPhase,
    onNext: currentIndex < totalQuestions - 1
      ? goNextQuestion
      : (!submitted ? handleSubmit : undefined),
    onSubmit: undefined,
    isFirst: false,
    isLast: false,
    sections,
    onSubmitTest: !submitted ? handleSubmit : undefined,
  }), [currentIndex, totalQuestions, submitted, handleSubmit, goPrevQuestion, goNextQuestion, goToPrevPhase, sections]);

  // Stable answer handlers (functional setState → no answer-array deps → not recreated on timer tick).
  const onAnswerP1 = useCallback((gi: number, val: number) => {
    if (submitted) return;
    setP1Answers((prev) => { const n = [...prev]; n[gi] = val; return n; });
  }, [submitted]);
  const onAnswerP3 = useCallback((si: number, pi: number) => {
    if (submitted) return;
    setP3Answers((prev) => { const n = [...prev]; n[si] = pi; return n; });
  }, [submitted]);
  const onAnswerP4 = useCallback((pIdx: number, val: number) => {
    if (submitted) return;
    setP4Answers((prev) => { const n = [...prev]; n[pIdx] = val; return n; });
  }, [submitted]);
  const onPlacementsChangeP2 = useCallback((sIdx: number, p: Record<number, string>) => {
    if (submitted) return;
    setP2Placements((prev) => prev.map((x, i) => (i === sIdx ? p : x)));
  }, [submitted]);
  const onSectionChangeP2 = useCallback((i: number) => setCurrentIndex(i), []);
  const onToggleBookmarkCurrent = useCallback(() => toggleBookmark(currentIndex), [toggleBookmark, currentIndex]);
  const onPart1Next = useCallback(() => { if (!submitted) handleSubmit(); }, [submitted, handleSubmit]);

  const isSinglePagePart = partType === "part1" || partType === "part3" || partType === "part4";
  const adminControls = !submitted && !reviewMode && (partType !== "part2" || phase !== "practice") ? (
    <AdminExamControls
      label={
        phase === "instructions"
          ? "Reading · Hướng dẫn"
          : phase === "reading_intro"
          ? "Reading · Bắt đầu"
          : isSinglePagePart
          ? `Reading · ${partLabel}`
          : `Reading · Câu ${currentIndex + 1}/${totalQuestions || 1}`
      }
      onSkip={() => {
        if (phase === "instructions") setPhase("reading_intro");
        else if (phase === "reading_intro") setPhase("practice");
        else if (!isSinglePagePart && currentIndex < totalQuestions - 1) setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1));
        else handleSubmit();
      }}
      onBack={
        phase === "instructions"
          ? onPreviousPart
          : phase === "reading_intro"
          ? () => setPhase("instructions")
          : !isSinglePagePart && currentIndex > 0
          ? () => setCurrentIndex((p) => Math.max(0, p - 1))
          : goToPrevPhase
      }
    />
  ) : null;

  const reportButton = phase === "practice" && !submitted && !reviewMode ? (
    <ExamReportButton
      examQuestionId={sourceQuestionIds?.[currentIndex] ?? sourceQuestionIds?.[0] ?? null}
      examSetId={null}
      skill="reading"
      partType={partType}
      questionNumber={currentIndex + 1}
    />
  ) : null;

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {adminControls}
        <ExamHeader skillLabel="Reading Đề 01" partLabel={partLabel} onExit={onExit} />
        {hasStarted && (
          <div className="px-6 pt-3">
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
          </div>
        )}
        <div className="flex-1 w-full pb-20">
          <ExamInstructions
            skillName="Reading"
            timeLeft={timeLeft}
            totalTime={timeLimit}
            totalParts={totalQuestions}
            totalMinutes={Math.ceil(timeLimit / 60)}
            onStart={() => setPhase("reading_intro")}
            sections={sections}
            description={testTitle}
          />
        </div>
      </div>
    );
  }

  if (phase === "reading_intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {adminControls}
        <ExamHeader skillLabel="Reading Đề 01" partLabel={partLabel} onExit={onExit} />
        {hasStarted && (
          <div className="px-6 pt-3">
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
          </div>
        )}
        <div className="flex-1 pl-[80px] pt-[40px] font-sans text-black">
          <h1 className="text-xl mb-6">Aptis General Reading Instructions</h1>
          <p className="font-bold mb-2">Reading</p>
          {fullFlow ? (
            <>
              <p className="mb-2">The test has five parts.</p>
              <p className="mb-2">You have {Math.ceil(timeLimit / 60)} minutes to complete the test.</p>
            </>
          ) : (
            <p className="mb-2">You have {Math.ceil(timeLimit / 60)} minutes to complete this part.</p>
          )}
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

  if (phase === "review" && showResultsOnSubmit && resultStats && !isReviewing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel="Reading" partLabel={partLabel} onExit={onExit} />
        <main className="flex-1 py-10 px-4">
          <ReadingResults
            correct={resultStats.correct}
            total={resultStats.total}
            partLabel={`${testTitle} – ${partLabel}`}
            onExit={onExit}
            onRetry={handleRetry}
            onReview={() => { setIsReviewing(true); setCurrentIndex(0); }}
            partType={partType}
            part1Question={part1Question}
            part1Answers={p1Answers}
            part2Question={part2Question}
            part2Placements={p2Placements}
            part3Question={part3Question}
            part3Answers={p3Answers}
            part4Question={part4Question}
            part4Answers={p4Answers}
          />
        </main>
      </div>
    );
  }

  return (
    <TimerProvider timeLeft={timeLeft} totalTime={timeLimit}>
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      {adminControls}
      {reportButton}
      <ExamHeader
        skillLabel="Reading Đề 01"
        partLabel={partLabel}
        onExit={onExit}
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        {partType === "part1" && part1Question && (
          <ReadingPart1Sentence
            question={part1Question}
            answers={p1Answers}
            submitted={submitted}
            onAnswer={onAnswerP1}
            {...navProps}
            onNext={onPart1Next}
            onSubmit={undefined}
            isFirst={false}
            isLast={false}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={onToggleBookmarkCurrent}
          />
        )}

        {partType === "part2" && part2Question && (
          <ReadingPart2Cohesion
            question={part2Question}
            placements={p2Placements}
            onPlacementsChange={onPlacementsChangeP2}
            submitted={submitted}
            onSubmit={!submitted ? handleSubmit : undefined}
            onPrevious={goToPrevPhase}
            sections={sections}
            currentSection={currentIndex}
            onSectionChange={onSectionChangeP2}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={onToggleBookmarkCurrent}
          />
        )}

        {partType === "part3" && part3Question && (
          <ReadingPart3Opinion
            question={part3Question}
            answers={p3Answers}
            submitted={submitted}
            currentStatement={currentIndex}
            onAnswer={onAnswerP3}
            {...navProps}
            onNext={onPart1Next}
            onSubmit={undefined}
            isFirst={false}
            isLast={false}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={onToggleBookmarkCurrent}
          />
        )}

        {partType === "part4" && part4Question && (
          <ReadingPart4Long
            question={part4Question}
            answers={p4Answers}
            currentIndex={currentIndex}
            submitted={submitted}
            onAnswer={onAnswerP4}
            {...navProps}
            onNext={onPart1Next}
            onSubmit={undefined}
            isFirst={false}
            isLast={false}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={onToggleBookmarkCurrent}
          />
        )}
      </div>
    </div>
    </TimerProvider>
  );
};

export default ReadingExamEngine;
