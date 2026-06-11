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
import AdminExamControls from "@/components/exam/AdminExamControls";
import { useExamGrading } from "@/hooks/useExamGrading";
import type {
  WritingPart1Data,
  WritingPart2Data,
  WritingPart3Data,
  WritingPart4Data,
} from "@/data/writingQuestions";

export type WritingPartType = "task1" | "task2" | "task3" | "task4";

export interface WritingPerQuestion {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

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
  fullFlow?: boolean;
  isLastPart?: boolean;
  onExit: () => void;
  onComplete?: (perQuestion?: WritingPerQuestion[]) => void;
  onPrevious?: () => void;
  /** DB exam_questions.id list — used to persist the user's essay per part. */
  sourceQuestionIds?: string[];
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  initialAnswers?: {
    shortAnswers?: string[];
    textAnswer?: string;
    part3Answers?: string[];
    informalAnswer?: string;
    formalAnswer?: string;
  };
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
  externalTimeLeft, onTimeTick, skipIntro, fullFlow, isLastPart,
  onExit, onComplete, onPrevious, sourceQuestionIds,
  reviewMode, initialAnswers,
}: WritingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode) ? "practice" : "instructions");
  const [internalTimeLeft, setInternalTimeLeft] = useState(externalTimeLeft ?? timeLimit);
  const timeLeft = externalTimeLeft ?? internalTimeLeft;
  const [submitted, setSubmitted] = useState(!!reviewMode);
  const [isReviewing, setIsReviewing] = useState(false);
  const [bookmarked, setBookmarked] = useState<Set<WritingPartType>>(new Set());
  const isBookmarked = bookmarked.has(partType);
  const toggleBookmark = useCallback(() => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(partType)) next.delete(partType);
      else next.add(partType);
      return next;
    });
  }, [partType]);

  const [shortAnswers, setShortAnswers] = useState<string[]>(
    reviewMode && initialAnswers?.shortAnswers ? initialAnswers.shortAnswers : new Array(part1Data?.questions.length || 5).fill("")
  );
  const [textAnswer, setTextAnswer] = useState(reviewMode ? (initialAnswers?.textAnswer || "") : "");
  const [part3Answers, setPart3Answers] = useState<string[]>(
    reviewMode && initialAnswers?.part3Answers ? initialAnswers.part3Answers : new Array(part3Data?.questions.length || 3).fill("")
  );
  const [informalAnswer, setInformalAnswer] = useState(reviewMode ? (initialAnswers?.informalAnswer || "") : "");
  const [formalAnswer, setFormalAnswer] = useState(reviewMode ? (initialAnswers?.formalAnswer || "") : "");

  const { grading, isGrading, gradeExam } = useExamGrading();

  // Ensure exam-mode dark overrides apply during intro phase too
  // (intro screen renders no ExamHeader, so the body class wouldn't be set).
  useEffect(() => {
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, []);


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
    if (!skipIntro || reviewMode) return;
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

  const buildPerQuestion = (): WritingPerQuestion[] | undefined => {
    if (!sourceQuestionIds || sourceQuestionIds.length === 0) return undefined;
    const { text } = getTextAndQuestions();
    return [{
      exam_question_id: sourceQuestionIds[0],
      user_answer: text,
      is_correct: false,
    }];
  };

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    const perQuestion = buildPerQuestion();

    // Full-test mode (parent passes isLastPart): skip grading/results entirely
    if (isLastPart !== undefined) {
      onComplete?.(perQuestion);
      return;
    }

    setPhase("grading");
    onComplete?.(perQuestion);

    const { text, questions } = getTextAndQuestions();

    await gradeExam({
      type: "writing",
      text,
      questions,
      partType,
    });

    setPhase("results");
  }, [onComplete, shortAnswers, textAnswer, part3Answers, informalAnswer, formalAnswer, partType, skipIntro, isLastPart, sourceQuestionIds]);

  const partLabel = PART_LABELS[partType];
  const adminControls = !submitted && !reviewMode ? (
    <AdminExamControls
      label={
        phase === "instructions"
          ? "Writing · Hướng dẫn"
          : phase === "writing_intro"
          ? "Writing · Bắt đầu"
          : `Writing · ${partLabel}`
      }
      onSkip={() => {
        if (phase === "instructions") setPhase("writing_intro");
        else if (phase === "writing_intro") setPhase("practice");
        else handleSubmit();
      }}
      onBack={
        phase === "instructions"
          ? onPrevious
          : phase === "writing_intro"
          ? () => setPhase("instructions")
          : onPrevious
      }
    />
  ) : null;

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
      questions: [{
        label: "01",
        seen: phase === "practice" || phase === "grading" || phase === "results",
        attempted: submitted,
        bookmarked: isBookmarked,
        isCurrent: phase === "practice",
        onClick: () => {},
      }],
    },
  ];

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white pl-20 pt-10 font-sans text-black">
        {adminControls}
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
        {adminControls}
        <ExamHeader skillLabel="Writing" partLabel="Aptis General Writing Instructions" onExit={onExit} />
        <div className="flex-1 bg-white pl-[80px] pt-[40px] font-sans text-black">
          <h1 className="text-xl mb-4">Aptis General Writing Instructions</h1>
          <p className="font-bold mb-2">Writing</p>
          {fullFlow ? (
            <>
              <p className="text-sm mb-1">The test has four parts and takes up to {Math.ceil(timeLimit / 60)} minutes.</p>
              <p className="text-sm mb-1">Recommended times: Part One: 6 min / Part Two: 12 min / Part Three: 17 min / Part Four: 15 min</p>
            </>
          ) : (
            <p className="text-sm mb-1">You have {Math.ceil(timeLimit / 60)} minutes to complete this part.</p>
          )}
          <p className="text-sm mb-1">&nbsp;</p>
          <p className="text-sm">When you click on the &apos;Next&apos; button, the test will begin.</p>
        </div>
        <BottomNavBar
          isFirst={false}
          isLast={false}
          onPrevious={() => setPhase("instructions")}
          onNext={() => setPhase("practice")}
          sections={sections}
        />
      </div>
    );
  }

  if ((phase === "grading" || phase === "results") && !isReviewing) {
    const submission = (() => {
      if (partType === "task1" && part1Data) {
        return part1Data.questions.map((q, i) => ({ prompt: q.text, answer: shortAnswers[i] || "", sampleAnswer: q.sampleAnswer }));
      }
      if (partType === "task2" && part2Data) {
        return [{ prompt: `${part2Data.instruction}\n${part2Data.question || ""}`.trim(), answer: textAnswer, sampleAnswer: part2Data.sampleAnswer }];
      }
      if (partType === "task3" && part3Data) {
        return part3Data.questions.map((q, i) => ({ prompt: q.text, answer: part3Answers[i] || "", sampleAnswer: q.sampleAnswer }));
      }
      if (partType === "task4" && part4Data) {
        return [
          { prompt: `Informal Email: ${part4Data.informalEmail.instruction}`, answer: informalAnswer, sampleAnswer: part4Data.informalEmail.sampleAnswer },
          { prompt: `Formal Email: ${part4Data.formalEmail.instruction}`, answer: formalAnswer, sampleAnswer: part4Data.formalEmail.sampleAnswer },
        ];
      }
      return [];
    })();
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <ExamHeader skillLabel="Writing" partLabel="Results" onExit={onExit} />
        <div className="flex-1 px-4 pt-8 pb-10">
          <WritingResults
            isGrading={isGrading}
            grading={grading}
            onExit={onExit}
            submission={submission}
            onReview={!isGrading && grading ? () => setIsReviewing(true) : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      {adminControls}
      <ExamHeader
        skillLabel="Writing"
        partLabel={partLabel}
        onExit={onExit}
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
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
            onPrevious={onPrevious}
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
            onPrevious={onPrevious}
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
            onPrevious={onPrevious}
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
            onPrevious={onPrevious}
            sections={sections}
          />
        )}
      </div>
    </div>
  );
};

export default WritingExamEngine;
