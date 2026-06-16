import { useEffect, useState, useCallback } from "react";
import ReadingExamEngine, { type ReadingPartType } from "@/components/reading/ReadingExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
} from "@/lib/examTransformers";
import { saveExamResult } from "@/lib/saveExamResult";
import { Trophy } from "lucide-react";

interface Props {
  sets: ExamSetRow[];
  partType: ReadingPartType;
  skillLabel: string;
  onExit: () => void;
}

type Phase = "loading" | "exam" | "completed";

const HUGE_TIME = 24 * 60 * 60; // 24h sentinel; hideTimer disables countdown anyway

const ReadingMarathonEngine = ({ sets, partType, skillLabel, onExit }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accCorrect, setAccCorrect] = useState(0);
  const [accTotal, setAccTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [engineData, setEngineData] = useState<any>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (currentIndex >= sets.length) return;
    let cancelled = false;
    setPhase("loading");
    setEngineData(null);
    (async () => {
      const set = sets[currentIndex];
      const questions = await fetchExamQuestions(set.id);
      if (cancelled) return;
      const data: any = {};
      switch (partType) {
        case "part1": data.part1Question = toReadingPart1(questions); break;
        case "part2": data.part2Question = toReadingPart2(questions); break;
        case "part3": data.part3Question = toReadingPart3(questions); break;
        case "part4": data.part4Question = toReadingPart4(questions); break;
      }
      setEngineData(data);
      setPhase("exam");
    })();
    return () => { cancelled = true; };
  }, [currentIndex, sets, partType]);

  const handleComplete = useCallback((correct: number, total: number) => {
    setAccCorrect((c) => c + correct);
    setAccTotal((t) => t + total);
    if (currentIndex < sets.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase("completed");
    }
  }, [currentIndex, sets.length]);

  // Persist a single aggregate row when we finish.
  useEffect(() => {
    if (phase !== "completed" || savedOnce) return;
    setSavedOnce(true);
    saveExamResult({
      examSetId: null,
      skill: "reading",
      correct: accCorrect,
      total: accTotal,
    });
  }, [phase, savedOnce, accCorrect, accTotal]);

  const partName =
    partType === "part1" ? "Part 1"
    : partType === "part2" ? "Part 2"
    : partType === "part3" ? "Part 3"
    : "Part 4";

  if (phase === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName}`} onExit={onExit} />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <p className="text-base text-muted-foreground mb-2">
              Bạn đã hoàn thành tất cả {sets.length} đề {partName}
            </p>
            <p className="text-4xl md:text-5xl font-heading font-extrabold text-foreground my-4">
              Đúng {accCorrect}/{accTotal} câu
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Button variant="outline" onClick={onExit}>Thoát</Button>
              <Button
                onClick={() => {
                  setAccCorrect(0);
                  setAccTotal(0);
                  setCurrentIndex(0);
                  setSavedOnce(false);
                  setPhase("exam");
                }}
              >
                Làm lại từ đầu
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "loading" || !engineData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName}`} onExit={onExit} />
        <main className="flex-1 flex items-center justify-center">
          <div className="space-y-4 text-center">
            <TechSkeleton variant="circle" className="h-12 w-12 mx-auto" />
            <TechSkeleton variant="text" className="w-40 mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <ReadingExamEngine
      key={currentIndex}
      partType={partType}
      testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}`}
      timeLimit={HUGE_TIME}
      hideTimer
      skipIntro
      showResultsOnSubmit={false}
      onExit={onExit}
      onComplete={handleComplete}
      {...engineData}
    />
  );
};

export default ReadingMarathonEngine;
