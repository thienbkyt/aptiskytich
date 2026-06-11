import { useState, useEffect, useCallback } from "react";
import ExamHeader from "@/components/exam/ExamHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ListeningPart1Word from "@/components/listening/ListeningPart1Word";
import ListeningPart2Match from "@/components/listening/ListeningPart2Match";
import ListeningPart3Conversation from "@/components/listening/ListeningPart3Conversation";
import ListeningPart4Monologue from "@/components/listening/ListeningPart4Monologue";
import ListeningResults from "@/components/listening/ListeningResults";
import AdminExamControls from "@/components/exam/AdminExamControls";
// Render dedicated results screen after submission when showResultsOnSubmit is true.
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";

export type ListeningPartType = "part1" | "part2" | "part3" | "part4";

export interface ListeningPerQuestion {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface ListeningExamEngineProps {
  partType: ListeningPartType;
  testTitle: string;
  timeLimit: number;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
  onExit: () => void;
  onComplete?: (correct: number, total: number, perQuestion?: ListeningPerQuestion[]) => void;
  onPreviousPart?: () => void;
  externalTimeLeft?: number;
  onTimeTick?: (t: number) => void;
  skipIntro?: boolean;
  fullFlow?: boolean;
  /** When true, render ListeningResults after submission instead of locked review. */
  showResultsOnSubmit?: boolean;
  /** DB exam_questions.id list for this part — used to persist per-question results. */
  sourceQuestionIds?: string[];
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  initialAnswers?: any[];
}

type Phase = "instructions" | "listening_intro" | "practice" | "review";

const PART_LABELS: Record<ListeningPartType, string> = {
  part1: "Part 1 – Word Recognition",
  part2: "Part 2 – Matching Information",
  part3: "Part 3 – Short Conversations",
  part4: "Part 4 – Monologues",
};

const ListeningExamEngine = ({
  partType, testTitle, timeLimit,
  part1Questions, part2Questions, part3Questions, part4Questions,
  onExit, onComplete, onPreviousPart, externalTimeLeft, onTimeTick, skipIntro, fullFlow,
  showResultsOnSubmit = false, sourceQuestionIds, reviewMode, initialAnswers,
}: ListeningExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode) ? "practice" : "instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(!!reviewMode);
  const [timeLeft, setTimeLeft] = useState(externalTimeLeft ?? timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [resultStats, setResultStats] = useState<{ correct: number; total: number } | null>(null);
  const [isReviewing, setIsReviewing] = useState(!!reviewMode);

  const toggleBookmark = useCallback((qi: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(qi)) next.delete(qi);
      else next.add(qi);
      return next;
    });
  }, []);

  const totalQuestions =
    partType === "part1" ? (part1Questions?.length || 0) :
    partType === "part2" ? (part2Questions?.length || 0) :
    partType === "part3" ? (part3Questions?.length || 0) :
    (part4Questions?.length || 0);

  const [answers, setAnswers] = useState<any[]>(
    reviewMode && initialAnswers ? initialAnswers : new Array(totalQuestions).fill(null)
  );

  useEffect(() => {
    if (phase === "practice") {
      setSeenQuestions((prev) => new Set(prev).add(currentIndex));
    }
  }, [phase, currentIndex]);

  // Reset internal state when partType changes (full-test flow keeps engine mounted).
  // Skip in reviewMode so pre-filled answers aren't wiped.
  useEffect(() => {
    if (reviewMode) return;
    setPhase(skipIntro ? "practice" : "instructions");
    setCurrentIndex(0);
    setSubmitted(false);
    setSeenQuestions(new Set());
    setAnswers(new Array(totalQuestions).fill(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partType]);

  useEffect(() => {
    if (phase !== "practice" || submitted || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        const next = p - 1;
        onTimeTick?.(Math.max(0, next));
        if (p <= 1) {
          clearInterval(t);
          handleSubmit();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, submitted, timeLeft]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPhase("review");
    setCurrentIndex(0);

    let correct = 0;
    if (partType === "part2" && part2Questions) {
      // Per-speaker scoring across all exercises
      part2Questions.forEach((q, i) => {
        const ans = (answers[i] || {}) as Record<string, string>;
        q.persons.forEach((p) => {
          const correctItem = q.infoItems.find((it) => it.correctPerson === p.name);
          if (correctItem && ans[p.name] === correctItem.text) correct += 1;
        });
      });
    } else if (partType === "part3" && part3Questions) {
      // Per-statement scoring
      part3Questions.forEach((q, i) => {
        const ans = (answers[i] || {}) as Record<number, string>;
        q.statements.forEach((s, si) => {
          if (ans[si] === s.correctAnswer) correct += 1;
        });
      });
    } else if (partType === "part4" && part4Questions) {
      part4Questions.forEach((clip, ci) => {
        const ans = (answers[ci] || {}) as Record<number, number>;
        clip.questions.forEach((qq, qi) => {
          if (ans[qi] === qq.correct) correct += 1;
        });
      });
    } else if (partType === "part1" && part1Questions) {
      correct = part1Questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    }
    const totalForScore = partType === "part4" && part4Questions
      ? part4Questions.reduce((s, c) => s + c.questions.length, 0)
      : partType === "part2" && part2Questions
      ? part2Questions.reduce((s, q) => s + q.persons.length, 0)
      : partType === "part3" && part3Questions
      ? part3Questions.reduce((s, q) => s + q.statements.length, 0)
      : totalQuestions;
    setResultStats({ correct, total: totalForScore });
    // Build perQuestion: 1 row per DB source question. Listening Part1 is 1:1;
    // Parts 2/3/4 compress all sub-answers per audio clip into one DB row, so
    // we serialize the user's answer object for that clip.
    let perQuestion: ListeningPerQuestion[] | undefined;
    if (sourceQuestionIds && sourceQuestionIds.length > 0) {
      if (partType === "part1" && part1Questions) {
        perQuestion = part1Questions.map((q, i) => ({
          exam_question_id: sourceQuestionIds[i] ?? sourceQuestionIds[0],
          user_answer: answers[i] != null ? String(answers[i]) : null,
          is_correct: answers[i] === q.correct,
        }));
      } else {
        // 1 row per DB question; sourceQuestionIds[i] aligns to nth clip/exercise
        const groupCount =
          partType === "part2" ? (part2Questions?.length || 1)
          : partType === "part3" ? (part3Questions?.length || 1)
          : (part4Questions?.length || 1);
        perQuestion = Array.from({ length: Math.min(groupCount, sourceQuestionIds.length) }, (_, i) => {
          const ans = answers[i];
          let groupCorrect = false;
          if (partType === "part2" && part2Questions?.[i]) {
            const q = part2Questions[i];
            const a = (ans || {}) as Record<string, string>;
            groupCorrect = q.persons.every((p) => {
              const item = q.infoItems.find((it) => it.correctPerson === p.name);
              return item ? a[p.name] === item.text : true;
            });
          } else if (partType === "part3" && part3Questions?.[i]) {
            const q = part3Questions[i];
            const a = (ans || {}) as Record<number, string>;
            groupCorrect = q.statements.every((s, si) => a[si] === s.correctAnswer);
          } else if (partType === "part4" && part4Questions?.[i]) {
            const c = part4Questions[i];
            const a = (ans || {}) as Record<number, number>;
            groupCorrect = c.questions.every((qq, qi) => a[qi] === qq.correct);
          }
          return {
            exam_question_id: sourceQuestionIds[i] ?? sourceQuestionIds[0],
            user_answer: JSON.stringify({ partType, answer: ans ?? null }),
            is_correct: groupCorrect,
          };
        });
      }
    }
    onComplete?.(correct, totalForScore, perQuestion);
  }, [partType, part1Questions, part2Questions, part3Questions, part4Questions, answers, totalQuestions, onComplete, sourceQuestionIds]);

  const handleRetry = () => {
    setSubmitted(false);
    setResultStats(null);
    setPhase("practice");
    setCurrentIndex(0);
    setTimeLeft(timeLimit);
    setSeenQuestions(new Set());
    setAnswers(new Array(totalQuestions).fill(null));
  };

  const handleAnswer = (qi: number, ai: any) => {
    if (submitted) return;
    const n = [...answers];
    n[qi] = ai;
    setAnswers(n);
  };

  const partLabel = PART_LABELS[partType];

  const sections = [
    {
      title: "Aptis General Listening Instructions",
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
        attempted: answers[qi] !== null && answers[qi] !== undefined,
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => { setPhase("practice"); setCurrentIndex(qi); },
      })),
    },
  ];

  const navProps = {
    onPrevious: currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : onPreviousPart,
    onNext: currentIndex < totalQuestions - 1
      ? () => setCurrentIndex((p) => p + 1)
      : (!submitted ? handleSubmit : undefined),
    onSubmit: undefined,
    isFirst: false,
    isLast: false,
    sections,
  };

  const adminControls = !submitted && !reviewMode ? (
    <AdminExamControls
      label={
        phase === "instructions"
          ? "Listening · Hướng dẫn"
          : phase === "listening_intro"
          ? "Listening · Bắt đầu"
          : `Listening · Câu ${currentIndex + 1}/${totalQuestions || 1}`
      }
      onSkip={() => {
        if (phase === "instructions") setPhase("listening_intro");
        else if (phase === "listening_intro") setPhase("practice");
        else if (currentIndex < totalQuestions - 1) setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1));
        else handleSubmit();
      }}
      onBack={
        phase === "instructions"
          ? onPreviousPart
          : phase === "listening_intro"
          ? () => setPhase("instructions")
          : currentIndex > 0
          ? () => setCurrentIndex((p) => Math.max(0, p - 1))
          : onPreviousPart
      }
    />
  ) : null;

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {adminControls}
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <ExamInstructions
          skillName="Listening"
          totalParts={totalQuestions}
          totalMinutes={Math.ceil(timeLimit / 60)}
          onStart={() => setPhase("listening_intro")}
          testTitle={testTitle}
        />
      </div>
    );
  }

  if (phase === "listening_intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {adminControls}
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <div className="flex-1 bg-white pl-[80px] pt-[40px] font-sans text-black">
          <h1 className="text-xl mb-4">Aptis General Listening Instructions</h1>
          <p className="font-bold mb-2">Listening</p>
          {fullFlow && (
            <p className="text-sm mb-1">You will listen to seventeen recordings.</p>
          )}
          <p className="text-sm mb-1">Click on the PLAY button to listen to each recording.</p>
          <p className="text-sm mb-1">You can listen to each recording TWO TIMES ONLY.</p>
          <p className="text-sm mb-1">
            You have {Math.ceil(timeLimit / 60)} minutes to complete {fullFlow ? "the test" : "this part"}.
          </p>
          <p className="text-sm mb-1">&nbsp;</p>
          <p className="text-sm">When you click on the 'Next' button, the test will begin.</p>
        </div>
        <BottomNavBar
          isFirst={false}
          onPrevious={() => setPhase("instructions")}
          onNext={() => setPhase("practice")}
          sections={sections}
        />
      </div>
    );
  }


  if (phase === "review" && showResultsOnSubmit && resultStats && !isReviewing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <main className="flex-1 py-10 px-4">
          <ListeningResults
            correct={resultStats.correct}
            total={resultStats.total}
            partLabel={`${testTitle} – ${partLabel}`}
            onExit={onExit}
            onRetry={handleRetry}
            onReview={() => { setIsReviewing(true); setCurrentIndex(0); }}
            partType={partType}
            part1Questions={part1Questions}
            part2Questions={part2Questions}
            part3Questions={part3Questions}
            part4Questions={part4Questions}
            userAnswers={answers}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      {adminControls}
      <ExamHeader
        skillLabel="Listening"
        partLabel={partLabel}
        onExit={onExit}
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        {partType === "part1" && part1Questions && (
          <ListeningPart1Word
            questions={part1Questions}
            currentIndex={currentIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={handleAnswer}
            {...navProps}
          />
        )}

        {partType === "part2" && part2Questions && (
          <ListeningPart2Match
            questions={part2Questions}
            currentIndex={currentIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={handleAnswer}
            {...navProps}
          />
        )}

        {partType === "part3" && part3Questions && (
          <ListeningPart3Conversation
            questions={part3Questions}
            currentIndex={currentIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={handleAnswer}
            {...navProps}
          />
        )}

        {partType === "part4" && part4Questions && (
          <ListeningPart4Monologue
            questions={part4Questions}
            currentIndex={currentIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={handleAnswer}
            {...navProps}
          />
        )}
      </div>
    </div>
  );
};

export default ListeningExamEngine;
