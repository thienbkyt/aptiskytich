import { useState, useEffect, useCallback } from "react";
import ExamHeader from "@/components/exam/ExamHeader";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ReadingPart1Sentence from "@/components/reading/ReadingPart1Sentence";
import ReadingPart2Cohesion from "@/components/reading/ReadingPart2Cohesion";
import ReadingPart3Opinion from "@/components/reading/ReadingPart3Opinion";
import ReadingPart4Long from "@/components/reading/ReadingPart4Long";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";

export type ReadingPartType = "part1" | "part2" | "part3" | "part4";

interface ReadingExamEngineProps {
  partType: ReadingPartType;
  testTitle: string;
  timeLimit: number;
  part1Questions?: ReadingSentenceQuestion[];
  part2Question?: ReadingCohesionQuestion;
  part3Question?: ReadingOpinionQuestion;
  part4Question?: ReadingLongQuestion;
  onExit: () => void;
  onComplete?: (correct: number, total: number) => void;
}

type Phase = "instructions" | "practice" | "review";

const ReadingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Questions, part2Question, part3Question, part4Question,
  onExit, onComplete,
}: ReadingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());

  const [p1Answers, setP1Answers] = useState<(number | null)[]>(
    new Array(part1Questions?.length || 0).fill(null)
  );
  const [p2Answers, setP2Answers] = useState<(number | null)[]>(
    new Array(part2Question?.gaps.length || 0).fill(null)
  );
  const [p3Answers, setP3Answers] = useState<(number | null)[]>(
    new Array(part3Question?.statements.length || 0).fill(null)
  );
  const [p4Answers, setP4Answers] = useState<(number | null)[]>(
    new Array(part4Question?.questions.length || 0).fill(null)
  );

  const totalQuestions = partType === "part1" ? (part1Questions?.length || 0)
    : partType === "part2" ? (part2Question?.gaps.length || 0)
    : partType === "part3" ? (part3Question?.statements.length || 0)
    : (part4Question?.questions.length || 0);

  const currentAnswers = partType === "part1" ? p1Answers
    : partType === "part2" ? p2Answers
    : partType === "part3" ? p3Answers
    : p4Answers;

  useEffect(() => {
    if (phase === "practice") {
      setSeenQuestions((prev) => new Set(prev).add(currentIndex));
    }
  }, [phase, currentIndex]);

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

    let correct = 0;
    if (partType === "part1" && part1Questions) {
      correct = part1Questions.reduce((acc, q, i) => acc + (p1Answers[i] === q.correct ? 1 : 0), 0);
    } else if (partType === "part2" && part2Question) {
      correct = part2Question.gaps.reduce((acc, g, i) => acc + (p2Answers[i] === g.correct ? 1 : 0), 0);
    } else if (partType === "part3" && part3Question) {
      correct = part3Question.statements.reduce((acc, s, i) => acc + (p3Answers[i] === s.correctPerson ? 1 : 0), 0);
    } else if (partType === "part4" && part4Question) {
      correct = part4Question.questions.reduce((acc, q, i) => acc + (p4Answers[i] === q.correct ? 1 : 0), 0);
    }
    onComplete?.(correct, totalQuestions);
  }, [partType, part1Questions, part2Question, part3Question, part4Question, p1Answers, p2Answers, p3Answers, p4Answers, totalQuestions, onComplete]);

  const isAnswered = (qi: number) => currentAnswers[qi] !== null;

  const partLabel = partType === "part1" ? "Part 1 – Sentence Comprehension"
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
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => { setPhase("practice"); setCurrentIndex(qi); },
      })),
    },
  ];

  const navProps = {
    onPrevious: currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : undefined,
    onNext: currentIndex < totalQuestions - 1 ? () => setCurrentIndex((p) => p + 1) : undefined,
    onSubmit: currentIndex === totalQuestions - 1 && !submitted ? handleSubmit : undefined,
    isFirst: currentIndex === 0,
    isLast: currentIndex === totalQuestions - 1,
    sections,
  };

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <ExamHeader skillLabel="Reading" partLabel={partLabel} onExit={onExit} />
        <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
          <ExamInstructions
            skillName={`Reading – ${partLabel}`}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            totalParts={totalQuestions}
            totalMinutes={Math.ceil(timeLimit / 60)}
            onStart={() => setPhase("practice")}
            sections={sections}
            description={`Bài luyện tập: ${testTitle}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Reading" partLabel={partLabel} onExit={onExit} />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
        {partType === "part1" && part1Questions && (
          <ReadingPart1Sentence
            questions={part1Questions}
            currentIndex={currentIndex}
            answers={p1Answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={(qi, ai) => {
              if (submitted) return;
              const n = [...p1Answers];
              n[qi] = ai;
              setP1Answers(n);
            }}
            {...navProps}
          />
        )}

        {partType === "part2" && part2Question && (
          <ReadingPart2Cohesion
            question={part2Question}
            answers={p2Answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={(gi, val) => {
              if (submitted) return;
              const n = [...p2Answers];
              n[gi] = val;
              setP2Answers(n);
            }}
            {...navProps}
            onPrevious={undefined}
            onNext={undefined}
            onSubmit={!submitted ? handleSubmit : undefined}
            isFirst={true}
            isLast={true}
          />
        )}

        {partType === "part3" && part3Question && (
          <ReadingPart3Opinion
            question={part3Question}
            answers={p3Answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            currentStatement={currentIndex}
            onAnswer={(si, pi) => {
              if (submitted) return;
              const n = [...p3Answers];
              n[si] = pi;
              setP3Answers(n);
            }}
            {...navProps}
          />
        )}

        {partType === "part4" && part4Question && (
          <ReadingPart4Long
            question={part4Question}
            answers={p4Answers}
            currentIndex={currentIndex}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onAnswer={(qi, ai) => {
              if (submitted) return;
              const n = [...p4Answers];
              n[qi] = ai;
              setP4Answers(n);
            }}
            {...navProps}
          />
        )}
      </div>
    </div>
  );
};

export default ReadingExamEngine;
