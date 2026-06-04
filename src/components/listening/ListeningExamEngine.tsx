import { useState, useEffect, useCallback } from "react";
import ExamHeader from "@/components/exam/ExamHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ListeningPart1Word from "@/components/listening/ListeningPart1Word";
import ListeningPart2Match from "@/components/listening/ListeningPart2Match";
import ListeningPart3Conversation from "@/components/listening/ListeningPart3Conversation";
import ListeningPart4Monologue from "@/components/listening/ListeningPart4Monologue";
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";

export type ListeningPartType = "part1" | "part2" | "part3" | "part4";

interface ListeningExamEngineProps {
  partType: ListeningPartType;
  testTitle: string;
  timeLimit: number;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
  onExit: () => void;
  onComplete?: (correct: number, total: number) => void;
  externalTimeLeft?: number;
  onTimeTick?: (t: number) => void;
  skipIntro?: boolean;
  fullFlow?: boolean;
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
  onExit, onComplete, externalTimeLeft, onTimeTick, skipIntro, fullFlow,
}: ListeningExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "practice" : "instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(externalTimeLeft ?? timeLimit);
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());

  const totalQuestions =
    partType === "part1" ? (part1Questions?.length || 0) :
    partType === "part2" ? (part2Questions?.length || 0) :
    partType === "part3" ? (part3Questions?.length || 0) :
    (part4Questions?.length || 0);

  const [answers, setAnswers] = useState<any[]>(
    new Array(totalQuestions).fill(null)
  );

  useEffect(() => {
    if (phase === "practice") {
      setSeenQuestions((prev) => new Set(prev).add(currentIndex));
    }
  }, [phase, currentIndex]);

  // Reset internal state when partType changes (full-test flow keeps engine mounted)
  useEffect(() => {
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
    onComplete?.(correct, totalForScore);
  }, [partType, part1Questions, part2Questions, part3Questions, part4Questions, answers, totalQuestions, onComplete]);

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
        attempted: answers[qi] !== null,
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => { setPhase("practice"); setCurrentIndex(qi); },
      })),
    },
  ];

  const navProps = {
    onPrevious: currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : undefined,
    onNext: currentIndex < totalQuestions - 1
      ? () => setCurrentIndex((p) => p + 1)
      : (!submitted ? handleSubmit : undefined),
    onSubmit: undefined,
    isFirst: false,
    isLast: false,
    sections,
  };

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
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
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <div className="flex-1 bg-white pl-[80px] pt-[40px] font-sans text-black">
          <h1 className="text-xl mb-4">Aptis General Listening Instructions</h1>
          <p className="font-bold mb-2">Listening</p>
          <p className="text-sm mb-1">You will listen to seventeen recordings.</p>
          <p className="text-sm mb-1">Click on the PLAY button to listen to each recording.</p>
          <p className="text-sm mb-1">You can listen to each recording TWO TIMES ONLY.</p>
          <p className="text-sm mb-1">You have 40 minutes to complete the test.</p>
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


  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
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
