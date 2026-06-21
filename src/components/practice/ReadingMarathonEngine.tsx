import { useEffect, useState, useCallback, useMemo } from "react";
import ReadingExamEngine, { type ReadingPartType } from "@/components/reading/ReadingExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
} from "@/lib/examTransformers";
import { saveExamResult } from "@/lib/saveExamResult";
import { Trophy, Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  sets: ExamSetRow[];
  partType: ReadingPartType;
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
  answers: any;
};

const HUGE_TIME = 24 * 60 * 60;

const ReadingMarathonEngine = ({ sets, partType, skillLabel, onExit }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enterAtLast, setEnterAtLast] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [engineData, setEngineData] = useState<any>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<(ResultEntry | undefined)[]>(
    () => new Array(sets.length).fill(undefined)
  );
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const accCorrect = useMemo(
    () => results.reduce((sum, r) => sum + (r?.correct ?? 0), 0),
    [results]
  );
  const accTotal = useMemo(
    () => results.reduce((sum, r) => sum + (r?.total ?? 0), 0),
    [results]
  );
  const reviewable = useMemo(
    () => results.filter((r): r is ResultEntry => !!r),
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

  const handleComplete = useCallback((correct: number, total: number, perQuestion?: any[]) => {
    const set = sets[currentIndex];
    const qResults: QResult[] = Array.isArray(perQuestion) ? (perQuestion as QResult[]) : [];
    let answers: any = [];
    try {
      const raw = qResults[0]?.user_answer;
      if (raw) {
        const parsed = JSON.parse(raw);
        answers = parsed?.answers ?? [];
      }
    } catch { /* noop */ }
    setResults((prev) => {
      const next = prev.slice();
      next[currentIndex] = {
        correct, total,
        examSetId: set.id,
        part: set.part,
        qResults,
        answers,
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
    (async () => {
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { buildReadingItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const items: any[] = [];
      reviewable.forEach((r) => {
        // engineData isn't preserved on the entry — rebuild from set questions on the fly
        // would be costly; skip per-set items here, marathons still ship raw.perSet.
        items.push({
          questionText: `Đề ${r.examSetId} · ${r.part}`,
          userAnswer: `${r.correct}/${r.total}`,
          isCorrect: r.correct === r.total,
        });
      });
      const { scaled50, band } = computeScaleAndBand("reading", accCorrect, accTotal);
      const snap = buildReviewSnapshot({
        skill: "reading",
        part: partType,
        testTitle: `Marathon · ${partName}`,
        score: accCorrect, total: accTotal,
        scaled50, band,
        items,
        raw: {
          mode: "marathon",
          partType,
          perSet: reviewable.map((r) => ({
            examSetId: r.examSetId, part: r.part,
            correct: r.correct, total: r.total,
            qResults: r.qResults, answers: r.answers,
          })),
        },
      });
      saveExamResult({
        examSetId: null,
        skill: "reading",
        correct: accCorrect,
        total: accTotal,
        extraSkillScores: { mode: "marathon", label: `Marathon · ${partName}` },
        reviewSnapshot: snap,
      });
    })();
  }, [phase, savedOnce, accCorrect, accTotal]);

  useEffect(() => {
    if (reviewIndex === null) return;
    document.body.classList.add("history-review-mode");
    return () => {
      document.body.classList.remove("history-review-mode");
    };
  }, [reviewIndex !== null]);

  const partName =
    partType === "part1" ? "Part 1"
    : partType === "part2" ? "Part 2"
    : partType === "part3" ? "Part 3"
    : "Part 4";

  const pagesPerSet = partType === "part2" ? 2 : 1;
  const pages = reviewable.flatMap((entry, ri) =>
    Array.from({ length: pagesPerSet }, (_, section) => ({ entry, ri, section }))
  );

  if (phase === "completed" && reviewIndex !== null && pages[reviewIndex]) {
    const page = pages[reviewIndex];
    const r = page.entry;
    const isFirst = reviewIndex === 0;
    const isLast = reviewIndex === pages.length - 1;
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button size="sm" variant="outline" onClick={() => setReviewIndex(null)}>
                Quay lại tổng kết
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                Trang <span className="font-bold text-foreground">{reviewIndex + 1}</span>/{pages.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                disabled={isFirst}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Trang trước</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewIndex((i) => (i !== null && i < pages.length - 1 ? i + 1 : i))}
                disabled={isLast}
                className="gap-1"
              >
                <span className="hidden sm:inline">Trang sau</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <HistoryReviewRenderer
          key={reviewIndex}
          examSetId={r.examSetId}
          skill="reading"
          part={r.part}
          testTitle={`Đề ${page.ri + 1}`}
          qResults={r.qResults}
          onExit={() => setReviewIndex(null)}
          pageBase={page.ri * pagesPerSet}
          pageTotal={pages.length}
          initialSection={page.section}
        />
      </div>
    );
  }

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
              {reviewable.length > 0 && (
                <Button variant="secondary" onClick={() => setReviewIndex(0)} className="gap-2">
                  <Eye className="w-4 h-4" /> Xem lại từng câu →
                </Button>
              )}
              <Button
                onClick={() => {
                  setResults(new Array(sets.length).fill(undefined));
                  setReviewIndex(null);
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

  const saved = results[currentIndex]?.answers;
  const initialAnswers: any = {};
  if (saved !== undefined) {
    if (partType === "part1") initialAnswers.p1 = saved;
    else if (partType === "part2") initialAnswers.p2 = saved;
    else if (partType === "part3") initialAnswers.p3 = saved;
    else if (partType === "part4") initialAnswers.p4 = saved;
  }

  return (
    <ReadingExamEngine
      key={`${attempt}-${currentIndex}`}
      partType={partType}
      testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}`}
      timeLimit={HUGE_TIME}
      hideTimer
      skipIntro
      allowReveal
      showResultsOnSubmit={false}
      onExit={onExit}
      onComplete={handleComplete}
      onPreviousPart={() => {
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
      }}
      initialAnswers={initialAnswers}
      pageBase={currentIndex * pagesPerSet}
      pageTotal={sets.length * pagesPerSet}
      {...engineData}
    />
  );
};

export default ReadingMarathonEngine;
