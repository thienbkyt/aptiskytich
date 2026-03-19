import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ListeningPart1Word from "@/components/listening/ListeningPart1Word";
import ListeningPart2Match from "@/components/listening/ListeningPart2Match";
import ListeningPart3Conversation from "@/components/listening/ListeningPart3Conversation";
import ListeningPart4Monologue from "@/components/listening/ListeningPart4Monologue";
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Question,
} from "@/data/listeningQuestions";

export type ListeningPartType = "part1" | "part2" | "part3" | "part4";

interface ListeningExamEngineProps {
  partType: ListeningPartType;
  testTitle: string;
  timeLimit: number;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Question[];
  onExit: () => void;
  onComplete?: (correct: number, total: number) => void;
}

type Phase = "instructions" | "practice" | "review";

const PART_LABELS: Record<ListeningPartType, string> = {
  part1: "Part 1 – Word Recognition",
  part2: "Part 2 – Matching Information",
  part3: "Part 3 – Short Conversations",
  part4: "Part 4 – Monologues",
};

const ListeningExamEngine = ({
  partType, testTitle, timeLimit,
  part1Questions, part2Questions, part3Questions, part4Questions,
  onExit, onComplete,
}: ListeningExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());

  const totalQuestions =
    partType === "part1" ? (part1Questions?.length || 0) :
    partType === "part2" ? (part2Questions?.length || 0) :
    partType === "part3" ? (part3Questions?.length || 0) :
    (part4Questions?.length || 0);

  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(totalQuestions).fill(null)
  );

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

    let correct = 0;
    const qs =
      partType === "part1" ? part1Questions :
      partType === "part2" ? part2Questions :
      partType === "part3" ? part3Questions :
      part4Questions;

    if (qs) {
      correct = qs.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0);
    }
    onComplete?.(correct, totalQuestions);
  }, [partType, part1Questions, part2Questions, part3Questions, part4Questions, answers, totalQuestions, onComplete]);

  const handleAnswer = (qi: number, ai: number) => {
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
        attempted: answers[qi] !== null,
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
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <ExamInstructions
          skillName={`Listening – ${partLabel}`}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          totalParts={totalQuestions}
          totalMinutes={Math.ceil(timeLimit / 60)}
          onStart={() => setPhase("practice")}
          sections={sections}
          description={`Bài luyện tập: ${testTitle}. Mỗi đoạn audio chỉ được nghe tối đa 2 lần.`}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      <div className="flex items-center mb-6">
        <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
      </div>

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
  );
};

export default ListeningExamEngine;
