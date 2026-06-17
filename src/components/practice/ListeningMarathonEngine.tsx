import { useEffect, useState, useCallback, useMemo } from "react";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
} from "@/lib/examTransformers";
import { saveExamResult } from "@/lib/saveExamResult";
import { Trophy } from "lucide-react";

interface Props {
  sets: ExamSetRow[];
  partType: ListeningPartType;
  skillLabel: string;
  onExit: () => void;
}

type Phase = "loading" | "exam" | "completed";

type QResult = { exam_question_id: string; user_answer: string | null; is_correct: boolean };

type ResultEntry = {
  correct: number;
  total: number;
  examSetId: string;
  part: string;
  qResults: QResult[];
};

const HUGE_TIME = 24 * 60 * 60;

const ListeningMarathonEngine = ({ sets, partType, skillLabel, onExit }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [engineData, setEngineData] = useState<any>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<(ResultEntry | undefined)[]>(
    () => new Array(sets.length).fill(undefined)
  );

  const accCorrect = useMemo(
    () => results.reduce((sum, r) => sum + (r?.correct ?? 0), 0),
    [results]
  );
  const accTotal = useMemo(
    () => results.reduce((sum, r) => sum + (r?.total ?? 0), 0),
    [results]
  );

  useEffect(() => {
    if (currentIndex >= sets.length) return;
    let cancelled = false;
    setPhase("loading");
    setEngineData(null);
    (async () => {
      const set = sets[currentIndex];
      const questions = await fetchExamQuestions(set.id);
      if (cancelled) return;
      const data: any = { sourceQuestionIds: questions.map((q: any) => q.id) };
      switch (partType) {
        case "part1": data.part1Questions = toListeningPart1(questions); break;
        case "part2": data.part2Questions = toListeningPart2(questions); break;
        case "part3": data.part3Questions = toListeningPart3(questions); break;
        case "part4": data.part4Questions = toListeningPart4(questions); break;
      }
      setEngineData(data);
      setPhase("exam");
    })();
    return () => { cancelled = true; };
  }, [currentIndex, sets, partType]);

  const handleComplete = useCallback((correct: number, total: number, perQuestion?: any[]) => {
    const set = sets[currentIndex];
    const qResults: QResult[] = Array.isArray(perQuestion) ? (perQuestion as QResult[]) : [];
    setResults((prev) => {
      const next = prev.slice();
      next[currentIndex] = {
        correct, total,
        examSetId: set.id,
        part: set.part,
        qResults,
      };
      return next;
    });
    if (currentIndex < sets.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase("completed");
    }
  }, [currentIndex, sets]);

  useEffect(() => {
    if (phase !== "completed" || savedOnce) return;
    setSavedOnce(true);
    saveExamResult({
      examSetId: null,
      skill: "listening",
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 flex-wrap">
              <Button variant="outline" onClick={onExit}>Thoát</Button>
              <Button
                onClick={() => {
                  setResults(new Array(sets.length).fill(undefined));
                  setCurrentIndex(0);
                  setSavedOnce(false);
                  setPhase("loading");
                  setAttempt((a) => a + 1);
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
    <ListeningExamEngine
      key={`${attempt}-${currentIndex}`}
      partType={partType}
      testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}`}
      timeLimit={HUGE_TIME}
      hideTimer
      skipIntro
      showResultsOnSubmit={false}
      onExit={onExit}
      onComplete={handleComplete}
      onPreviousPart={() => {
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
      }}
      {...engineData}
    />
  );
};

export default ListeningMarathonEngine;
