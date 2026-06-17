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

type LoadedSet = {
  engineData: any;
  pageCount: number;
};

const HUGE_TIME = 24 * 60 * 60;

const ListeningMarathonEngine = ({ sets, partType, skillLabel, onExit }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enterAtLast, setEnterAtLast] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loaded, setLoaded] = useState<LoadedSet[] | null>(null);
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

  // Preload all sets in parallel
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setLoaded(null);
    (async () => {
      const allLoaded = await Promise.all(
        sets.map(async (set) => {
          const questions = await fetchExamQuestions(set.id);
          const data: any = { sourceQuestionIds: questions.map((q: any) => q.id) };
          let pageCount = 0;
          switch (partType) {
            case "part1": {
              const arr = toListeningPart1(questions);
              data.part1Questions = arr;
              pageCount = arr.length;
              break;
            }
            case "part2": {
              const arr = toListeningPart2(questions);
              data.part2Questions = arr;
              pageCount = arr.length;
              break;
            }
            case "part3": {
              const arr = toListeningPart3(questions);
              data.part3Questions = arr;
              pageCount = arr.length;
              break;
            }
            case "part4": {
              const arr = toListeningPart4(questions);
              data.part4Questions = arr;
              pageCount = arr.length;
              break;
            }
          }
          return { engineData: data, pageCount } as LoadedSet;
        })
      );
      if (cancelled) return;
      setLoaded(allLoaded);
      setPhase("exam");
    })();
    return () => { cancelled = true; };
  }, [sets, partType, attempt]);

  const pageTotal = useMemo(
    () => (loaded ? loaded.reduce((s, l) => s + l.pageCount, 0) : 0),
    [loaded]
  );
  const pageBase = useMemo(() => {
    if (!loaded) return 0;
    let base = 0;
    for (let i = 0; i < currentIndex && i < loaded.length; i++) base += loaded[i].pageCount;
    return base;
  }, [loaded, currentIndex]);

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
    setEnterAtLast(false);
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

  if (phase === "loading" || !loaded) {
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

  const engineData = loaded[currentIndex]?.engineData;
  if (!engineData) return null;

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
      pageBase={pageBase}
      pageTotal={pageTotal}
      {...engineData}
    />
  );
};

export default ListeningMarathonEngine;
