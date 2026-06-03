import { useState, useEffect, useCallback } from "react";
import ExamHeader from "@/components/exam/ExamHeader";
import ExamInstructions from "@/components/exam/ExamInstructions";
import WritingPart1Short from "@/components/writing/WritingPart1Short";
import WritingPart2Social from "@/components/writing/WritingPart2Social";
import WritingPart3Questions from "@/components/writing/WritingPart3Questions";
import WritingPart4TwoEmails from "@/components/writing/WritingPart4TwoEmails";
import WritingResults from "@/components/writing/WritingResults";
import SpeakingFooter from "@/components/speaking/SpeakingFooter";
import BottomNavBar from "@/components/reading/BottomNavBar";
import { useExamGrading } from "@/hooks/useExamGrading";
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
  externalTimeLeft?: number;
  onTimeTick?: (t: number) => void;
  skipIntro?: boolean;
  onExit: () => void;
  onComplete?: () => void;
}

type Phase = "instructions" | "writing_intro" | "practice" | "grading" | "results";

const PART_LABELS: Record<WritingPartType, string> = {
  task1: "Part 1 – Short Answers",
  task2: "Part 2 – Social Media Response",
  task3: "Part 3 – Three Questions",
  task4: "Part 4 – Informal & Formal Email",
};

const WritingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  externalTimeLeft, onTimeTick, skipIntro,
  onExit, onComplete,
}: WritingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "practice" : "instructions");
  const [internalTimeLeft, setInternalTimeLeft] = useState(externalTimeLeft ?? timeLimit);
  const timeLeft = externalTimeLeft ?? internalTimeLeft;
  const [submitted, setSubmitted] = useState(false);

  const [shortAnswers, setShortAnswers] = useState<string[]>(
    new Array(part1Data?.questions.length || 5).fill("")
  );
  const [textAnswer, setTextAnswer] = useState("");
  const [part3Answers, setPart3Answers] = useState<string[]>(
    new Array(part3Data?.questions.length || 3).fill("")
  );
  const [informalAnswer, setInformalAnswer] = useState("");
  const [formalAnswer, setFormalAnswer] = useState("");

  const { grading, isGrading, gradeExam } = useExamGrading();

  useEffect(() => {
    if (phase !== "practice" || submitted || timeLeft <= 0) return;
    const t = setInterval(() => {
      const next = timeLeft - 1;
      if (onTimeTick) onTimeTick(Math.max(0, next));
      if (externalTimeLeft === undefined) {
        setInternalTimeLeft((p) => (p <= 1 ? 0 : p - 1));
      }
      if (next <= 0) {
        clearInterval(t);
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, submitted, timeLeft, externalTimeLeft, onTimeTick]);

  // Full-test flow: when parent advances partType, reset to practice for the new part
  useEffect(() => {
    if (!skipIntro) return;
    setPhase("practice");
    setSubmitted(false);
    setShortAnswers(new Array(part1Data?.questions.length || 5).fill(""));
    setTextAnswer("");
    setPart3Answers(new Array(part3Data?.questions.length || 3).fill(""));
    setInformalAnswer("");
    setFormalAnswer("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partType]);


  const getTextAndQuestions = (): { text: string; questions: string[] } => {
    if (partType === "task1" && part1Data) {
      return {
        text: shortAnswers.map((a, i) => `Q${i + 1}: ${part1Data.questions[i].text}\nA: ${a}`).join("\n\n"),
        questions: part1Data.questions.map(q => q.text),
      };
    }
    if (partType === "task2" && part2Data) {
      return {
        text: textAnswer,
        questions: [part2Data.instruction, part2Data.question].filter(Boolean),
      };
    }
    if (partType === "task3" && part3Data) {
      return {
        text: part3Answers.map((a, i) => `Q${i + 1}: ${part3Data.questions[i].text}\nA: ${a}`).join("\n\n"),
        questions: part3Data.questions.map(q => q.text),
      };
    }
    if (partType === "task4" && part4Data) {
      return {
        text: `Informal Email:\n${informalAnswer}\n\nFormal Email:\n${formalAnswer}`,
        questions: [
          `Informal: ${part4Data.informalEmail.instruction}`,
          `Formal: ${part4Data.formalEmail.instruction}`,
        ],
      };
    }
    return { text: "", questions: [] };
  };

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    setPhase("grading");
    onComplete?.();

    const { text, questions } = getTextAndQuestions();

    await gradeExam({
      type: "writing",
      text,
      questions,
      partType,
    });

    setPhase("results");
  }, [onComplete, shortAnswers, textAnswer, part3Answers, informalAnswer, formalAnswer, partType]);

  const partLabel = PART_LABELS[partType];

  const sections = [
    {
      title: "Aptis General Writing Instructions",
      isCurrent: phase === "instructions" || phase === "writing_intro",
      onClick: () => {},
    },
    {
      title: partLabel,
      questionCount: partType === "task1" ? (part1Data?.questions.length || 5) : partType === "task3" ? (part3Data?.questions.length || 3) : partType === "task4" ? 2 : 1,
      isCurrent: phase === "practice" || phase === "grading" || phase === "results",
      onClick: () => {},
    },
  ];

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white pl-20 pt-10 font-sans text-black">
        <p className="text-sm text-gray-700 mb-2">Aptis General Practice Test</p>
        <h1 className="text-xl font-bold mb-6">Writing Practice Test {testTitle}</h1>
        <div className="flex gap-16 mb-8">
          <div>
            <p className="text-xs text-gray-500 mb-1">Number of Questions</p>
            <p className="font-bold">4</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Time Allowed</p>
            <p className="font-bold">{Math.ceil(timeLimit / 60)} min</p>
          </div>
        </div>
        <p className="text-sm font-bold mb-4">Assessment Description</p>
        <button
          onClick={() => setPhase("writing_intro")}
          className="bg-[#2D1B69] text-white rounded px-5 py-2.5 hover:bg-[#1f1149] transition-colors"
        >
          Start Assessment
        </button>
      </div>
    );
  }

  if (phase === "writing_intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ExamHeader skillLabel="Writing" partLabel="Aptis General Writing Instructions" onExit={onExit} />
        <div className="flex-1 flex flex-col items-center justify-start pt-12 px-4 pb-24">
          <div className="w-full max-w-[600px]">
            <h1 className="text-xl font-heading font-bold text-foreground mb-6">
              Aptis General Writing Instructions
            </h1>
            <h2 className="text-base font-heading font-bold text-foreground mb-4">Writing</h2>
            <p className="text-sm text-foreground mb-4">
              The test has four parts and takes up to 50 minutes.
            </p>
            <p className="text-sm font-semibold text-foreground mb-2">Recommended times:</p>
            <div className="text-sm text-foreground space-y-1 mb-6 pl-4">
              <p>Part One: 6 minutes</p>
              <p>Part Two: 12 minutes</p>
              <p>Part Three: 17 minutes</p>
              <p>Part Four: 15 minutes</p>
            </div>
            <p className="text-sm text-foreground">
              When you click on the &apos;Next&apos; button, the test will begin.
            </p>
          </div>
        </div>
        <BottomNavBar
          isFirst={true}
          isLast={false}
          onNext={() => setPhase("practice")}
          sections={sections}
        />
      </div>
    );
  }

  if (phase === "grading" || phase === "results") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <ExamHeader skillLabel="Writing" partLabel="Results" onExit={onExit} />
        <div className="flex-1 px-4 pt-8">
          <WritingResults isGrading={isGrading} grading={grading} onExit={onExit} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Writing" partLabel={partLabel} onExit={onExit} />
      <div className="flex-1 px-4 pt-8 pb-20 max-w-3xl mx-auto w-full">
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
          <WritingPart3Questions
            data={part3Data}
            answers={part3Answers}
            onAnswerChange={(i, val) => {
              const n = [...part3Answers];
              n[i] = val;
              setPart3Answers(n);
            }}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onSubmit={handleSubmit}
            sections={sections}
          />
        )}

        {partType === "task4" && part4Data && (
          <WritingPart4TwoEmails
            data={part4Data}
            informalAnswer={informalAnswer}
            formalAnswer={formalAnswer}
            onInformalChange={setInformalAnswer}
            onFormalChange={setFormalAnswer}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            onSubmit={handleSubmit}
            sections={sections}
          />
        )}
      </div>
    </div>
  );
};

export default WritingExamEngine;
