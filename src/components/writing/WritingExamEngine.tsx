import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import ExamInstructions from "@/components/exam/ExamInstructions";
import WritingPart1Short from "@/components/writing/WritingPart1Short";
import WritingPart2Social from "@/components/writing/WritingPart2Social";
import WritingPart3Informal from "@/components/writing/WritingPart3Informal";
import WritingPart4Formal from "@/components/writing/WritingPart4Formal";
import type {
  WritingPart1Data,
  WritingPart2Data,
  WritingPart3Data,
  WritingPart4Data,
} from "@/data/writingQuestions";

export type WritingPartType = "task1" | "task2" | "task3" | "task4";

interface WritingExamEngineProps {
  partType: WritingPartType;
  testTitle: string;
  timeLimit: number;
  part1Data?: WritingPart1Data;
  part2Data?: WritingPart2Data;
  part3Data?: WritingPart3Data;
  part4Data?: WritingPart4Data;
  onExit: () => void;
  onComplete?: () => void;
}

type Phase = "instructions" | "practice" | "submitted";

const PART_LABELS: Record<WritingPartType, string> = {
  task1: "Part 1 – Short Answers",
  task2: "Part 2 – Social Media Response",
  task3: "Part 3 – Informal Email",
  task4: "Part 4 – Formal Email",
};

const WritingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  onExit, onComplete,
}: WritingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [submitted, setSubmitted] = useState(false);

  // Part 1: array of short answers
  const [shortAnswers, setShortAnswers] = useState<string[]>(
    new Array(part1Data?.questions.length || 5).fill("")
  );
  // Part 2-4: single textarea
  const [textAnswer, setTextAnswer] = useState("");

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
    setPhase("submitted");
    onComplete?.();
  }, [onComplete]);

  const partLabel = PART_LABELS[partType];

  const sections = [
    {
      title: "Aptis General Writing Instructions",
      isCurrent: phase === "instructions",
      onClick: () => {},
    },
    {
      title: partLabel,
      questionCount: partType === "task1" ? (part1Data?.questions.length || 5) : 1,
      isCurrent: phase !== "instructions",
      onClick: () => {},
    },
  ];

  if (phase === "instructions") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <ExamInstructions
          skillName={`Writing – ${partLabel}`}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          totalParts={1}
          totalMinutes={Math.ceil(timeLimit / 60)}
          onStart={() => setPhase("practice")}
          sections={sections}
          description={`Bài luyện tập: ${testTitle}`}
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

      {partType === "task1" && part1Data && (
        <WritingPart1Short
          data={part1Data}
          answers={shortAnswers}
          onAnswerChange={(i, val) => {
            const n = [...shortAnswers];
            n[i] = val;
            setShortAnswers(n);
          }}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          submitted={submitted}
          onSubmit={handleSubmit}
          sections={sections}
        />
      )}

      {partType === "task2" && part2Data && (
        <WritingPart2Social
          data={part2Data}
          answer={textAnswer}
          onAnswerChange={setTextAnswer}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          submitted={submitted}
          onSubmit={handleSubmit}
          sections={sections}
        />
      )}

      {partType === "task3" && part3Data && (
        <WritingPart3Informal
          data={part3Data}
          answer={textAnswer}
          onAnswerChange={setTextAnswer}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          submitted={submitted}
          onSubmit={handleSubmit}
          sections={sections}
        />
      )}

      {partType === "task4" && part4Data && (
        <WritingPart4Formal
          data={part4Data}
          answer={textAnswer}
          onAnswerChange={setTextAnswer}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          submitted={submitted}
          onSubmit={handleSubmit}
          sections={sections}
        />
      )}
    </div>
  );
};

export default WritingExamEngine;
