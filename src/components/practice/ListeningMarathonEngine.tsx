import { useEffect, useState, useCallback, useMemo } from "react";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
} from "@/lib/examTransformers";
import { saveExamResult } from "@/lib/saveExamResult";
import { saveMarathonProgress, clearMarathonProgress, saveMarathonLast, loadMarathonProgress } from "@/lib/marathonProgress";
import { Trophy, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import MarathonNavigator from "@/components/practice/MarathonNavigator";

interface Props {
  sets: ExamSetRow[];
  partType: ListeningPartType;
  skillLabel: string;
  onExit: () => void;
  resume?: boolean;
  persist?: boolean;
  wrongQuestionIdsBySet?: Record<string, string[]>;
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

const ListeningMarathonEngine = ({ sets, partType, skillLabel, onExit, resume = false, persist = true, wrongQuestionIdsBySet }: Props) => {
  const savedInit = resume && persist ? loadMarathonProgress("listening", partType) : null;
  const [currentIndex, setCurrentIndex] = useState(savedInit?.currentIndex ?? 0);
  const [enterAtLast, setEnterAtLast] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loaded, setLoaded] = useState<LoadedSet[] | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<(ResultEntry | undefined)[]>(() => {
    const base = new Array(sets.length).fill(undefined);
    savedInit?.results?.forEach((r) => {
      if (!r) return;
      const idx = sets.findIndex((s) => s.id === r.examSetId);
      if (idx >= 0) base[idx] = r as any;
    });
    return base;
  });
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

  // Preload all sets in parallel
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setLoaded(null);
    (async () => {
      const allLoaded = await Promise.all(
        sets.map(async (set) => {
          let questions = await fetchExamQuestions(set.id);
          const wrongIds = wrongQuestionIdsBySet?.[set.id];
          if (partType === "part1" && wrongIds?.length) {
            const wset = new Set(wrongIds);
            questions = questions.filter((q: any) => wset.has(q.id));
          }
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
    const entry: ResultEntry = { correct, total, examSetId: set.id, part: set.part, qResults };
    const nextResults = results.slice();
    nextResults[currentIndex] = entry;
    const isLastSet = currentIndex >= sets.length - 1;
    const nextIndex = isLastSet ? currentIndex : currentIndex + 1;
    setResults(nextResults);
    setEnterAtLast(false);
    if (persist) {
      saveMarathonProgress("listening", partType, { currentIndex: nextIndex, results: nextResults as any, updatedAt: Date.now() });
    }
    if (!isLastSet) setCurrentIndex(nextIndex);
    else setPhase("completed");
  }, [currentIndex, sets, results, persist, partType]);

  useEffect(() => {
    if (phase !== "completed" || savedOnce) return;
    setSavedOnce(true);
    if (accTotal === 0) return;
    (async () => {
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { buildListeningItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const items: any[] = [];
      reviewable.forEach((r) => {
        const ed = loaded?.[sets.findIndex((s) => s.id === r.examSetId)]?.engineData ?? null;
        if (ed) {
          try {
            items.push(...buildListeningItems(partType as any, ed, {}, r.qResults || []));
          } catch { /* noop */ }
        }
      });
      const { scaled50, band } = computeScaleAndBand("listening", accCorrect, accTotal);
      const snap = buildReviewSnapshot({
        skill: "listening",
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
            qResults: r.qResults,
            engineData: loaded?.[sets.findIndex((s) => s.id === r.examSetId)]?.engineData ?? null,
          })),
        },
      });
      saveExamResult({
        examSetId: null,
        skill: "listening",
        correct: accCorrect,
        total: accTotal,
        extraSkillScores: { mode: "marathon", label: `Marathon · ${partName}` },
        reviewSnapshot: snap,
      });
      if (persist) {
        const wrongSetIds = reviewable
          .filter((r) => r.qResults.some((q) => !q.is_correct))
          .map((r) => r.examSetId);
        const wrongQBySet: Record<string, string[]> = {};
        reviewable.forEach((r) => {
          const wq = r.qResults.filter((q) => !q.is_correct).map((q) => q.exam_question_id);
          if (wq.length) wrongQBySet[r.examSetId] = wq;
        });
        saveMarathonLast("listening", partType, { correct: accCorrect, total: accTotal, wrongSetIds, wrongQuestionsBySet: wrongQBySet, updatedAt: Date.now() });
        clearMarathonProgress("listening", partType);
      }
    })();
  }, [phase, savedOnce, accCorrect, accTotal]);

  // Add body class while reviewing for any review-mode global styles.
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

  // Build flat pages array across all completed sets — 1 page per qResults entry.
  const pages = useMemo(() => {
    const out: { entry: ResultEntry; q: number; priorPages: number }[] = [];
    let prior = 0;
    for (const entry of reviewable) {
      const count = entry.qResults.length;
      for (let q = 0; q < count; q++) {
        out.push({ entry, q, priorPages: prior });
      }
      prior += count;
    }
    return out;
  }, [reviewable]);

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
          skill="listening"
          part={r.part}
          testTitle={`Đề ${reviewable.indexOf(r) + 1}`}
          qResults={r.qResults}
          onExit={() => setReviewIndex(null)}
          pageBase={page.priorPages}
          pageTotal={pages.length}
          initialSection={page.q}
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
              Bạn đã làm {reviewable.length}/{sets.length} đề {partName}
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
                  if (persist) clearMarathonProgress("listening", partType);
                  setResults(new Array(sets.length).fill(undefined));
                  setReviewIndex(null);
                  setCurrentIndex(0);
                  setEnterAtLast(false);
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

  // Rebuild initialAnswers for current set from previously saved qResults so
  // Previous navigation keeps the user's selections intact.
  const prevEntry = results[currentIndex];
  let initialAnswers: any[] | undefined;
  if (prevEntry?.qResults?.length) {
    if (partType === "part1") {
      initialAnswers = prevEntry.qResults.map((r) => {
        const n = r.user_answer != null ? parseInt(r.user_answer, 10) : NaN;
        return Number.isFinite(n) ? n : null;
      });
    } else {
      initialAnswers = prevEntry.qResults.map((r) => {
        if (!r.user_answer) return null;
        try {
          const p = JSON.parse(r.user_answer);
          return p?.answer ?? null;
        } catch { return null; }
      });
    }
  }

  return (
    <ListeningExamEngine
      key={`${attempt}-${currentIndex}`}
      partType={partType}
      testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}`}
      timeLimit={HUGE_TIME}
      hideTimer
      skipIntro
      allowReveal
      reviewScopeNote={`Marathon · Đề ${currentIndex + 1}/${sets.length} — chỉ xét câu chưa làm của đề này`}
      onMarathonFinish={() => setPhase("completed")}
      showResultsOnSubmit={false}
      onExit={onExit}
      onComplete={handleComplete}
      onPreviousPart={() => {
        if (currentIndex > 0) {
          setEnterAtLast(true);
          setCurrentIndex((i) => i - 1);
        }
      }}
      initialQuestion={
        enterAtLast
          ? Math.max(1, loaded[currentIndex]?.pageCount ?? 1) - 1
          : 0
      }
      initialAnswers={initialAnswers}
      pageBase={pageBase}
      pageTotal={pageTotal}
      {...engineData}
    />
  );
};

export default ListeningMarathonEngine;
