import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import { examLoadReason } from "@/lib/examLoadError";
import { mapWithLimit } from "@/lib/concurrency";
import ExamLoadErrorModal, { type ExamLoadErrorState } from "@/components/exam/ExamLoadErrorModal";
import {
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
} from "@/lib/examTransformers";
import { upsertMarathonResult, saveExamResult } from "@/lib/saveExamResult";
import { saveMarathonProgress, clearMarathonProgress, saveMarathonLast, loadMarathonProgress, newMarathonSessionId } from "@/lib/marathonProgress";
import { Trophy, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import MarathonNavigator from "@/components/practice/MarathonNavigator";
import { recordMarathonOpenedSets } from "@/lib/marathonOpenSets";

interface Props {
  sets: ExamSetRow[];
  /** Isolates saved progress per source (e.g. a specific prediction key + priority). */
  scopeId?: string;
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

const ListeningMarathonEngine = ({ sets: setsInput, scopeId, partType, skillLabel, onExit, resume = false, persist = true, wrongQuestionIdsBySet }: Props) => {
  /** Never let a duplicated exam_set_id create two rounds of the same đề. */
  const sets = useMemo(() => {
    const seen = new Set<string>();
    return (setsInput || []).filter((s) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [setsInput]);
  /** Stable identity of the run's đề list — avoids reloading everything on re-render. */
  const setsKey = sets.map((s) => s.id).join(",");
  /** Progress storage key: scoped so two different key days never share progress. */
  const progPart = scopeId ? `${partType}@${scopeId}` : partType;
  const savedInit = resume && persist ? loadMarathonProgress("listening", progPart) : null;
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    const ids = sets.map((s) => s.id).filter(Boolean);
    if (ids.length === 0) return;
    openedRef.current = true;
    void recordMarathonOpenedSets("listening", partType, ids);
  }, [sets, partType]);
  const [currentIndex, setCurrentIndex] = useState(Math.min(Math.max(0, savedInit?.currentIndex ?? 0), Math.max(0, (setsInput?.length ?? 1) - 1)));
  const [enterAtLast, setEnterAtLast] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loaded, setLoaded] = useState<LoadedSet[] | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadErr, setLoadErr] = useState<ExamLoadErrorState | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, any[]>>(() => (savedInit?.drafts as any) ?? {});
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
  const [midReview, setMidReview] = useState<{ setIndex: number; qIndex: number } | null>(null);
  const [jumpQ, setJumpQ] = useState<number | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [currentLocked, setCurrentLocked] = useState<boolean[]>([]);
  const [unlockSignal, setUnlockSignal] = useState<{ qi: number; n: number } | null>(null);
  const [submitSignal, setSubmitSignal] = useState(0);
  const pendingJumpRef = useRef<{ si: number; qi: number } | null>(null);
  const sessionIdRef = useRef<string>(savedInit?.sessionId ?? newMarathonSessionId());
  const testResultIdRef = useRef<string | null>(savedInit?.testResultId ?? null);
  const savingHistoryRef = useRef(false);
  const resultsRef = useRef<(ResultEntry | undefined)[]>(results);
  useEffect(() => { resultsRef.current = results; }, [results]);
  const isRetryMode = !!wrongQuestionIdsBySet;

  // Reset current-set answered tracking when the active set changes.
  useEffect(() => { setCurrentAnswers([]); setCurrentLocked([]); }, [currentIndex, attempt]);

  const isAnswerFilled = (a: any) => {
    if (a == null) return false;
    if (typeof a === "string") return a !== "";
    if (Array.isArray(a)) return a.length > 0;
    if (typeof a === "number") return a >= 0;
    if (typeof a === "object") return Object.values(a).some((v) => v != null && v !== "");
    return !!a;
  };

  // Mục lục THEO CÂU: mỗi câu trong đề là một ô.
  const currentAnswered = useMemo(() => {
    try {
      return (currentAnswers ?? []).map((a: any) => isAnswerFilled(a));
    } catch { return []; }
  }, [currentAnswers]);



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

  // Preload sets theo lô (giới hạn 4 request đồng thời)
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setLoaded(null);
    setLoadErr(null);
    setLoadProgress(0);
    (async () => {
      try {
      const allLoaded = await mapWithLimit(sets, 4, async (set) => {
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
          if (!cancelled) setLoadProgress((n) => n + 1);
          return { engineData: data, pageCount } as LoadedSet;
        });
      if (cancelled) return;
      setLoaded(allLoaded);
      setPhase("exam");
      } catch (e) {
        if (cancelled) return;
        const reason = examLoadReason(e) ?? "fetch_failed";
        setLoadErr({ reason, accessTier: (sets[0] as any)?.access_tier ?? null });
      }
    })();
    return () => { cancelled = true; };
  }, [setsKey, partType, attempt, loadTick]);

  // Mục lục theo ĐỀ → pageBase = chỉ số đề hiện tại, pageTotal = tổng số đề.
  const pageTotal = sets.length;
  const pageBase = currentIndex;


  const handleComplete = useCallback((correct: number, total: number, perQuestion?: any[]) => {
    const set = sets[currentIndex];
    const qResults: QResult[] = Array.isArray(perQuestion) ? (perQuestion as QResult[]) : [];
    const entry: ResultEntry = { correct, total, examSetId: set.id, part: set.part, qResults };
    // Also save a per-set record so this exam shows as "Đã làm" in the part list.
    if (persist) {
      const edSnapshot = loaded?.[currentIndex]?.engineData ?? null;
      (async () => {
        let snap: any = null;
        try {
          const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
          const { buildListeningItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
          const { scaled50, band } = computeScaleAndBand("listening", correct, total);
          snap = buildReviewSnapshot({
            skill: "listening",
            part: partType,
            testTitle: `Đề ${currentIndex + 1}/${sets.length}`,
            score: correct, total,
            scaled50, band,
            items: buildListeningItems(partType as any, edSnapshot, {}, qResults || []),
            raw: { engineData: edSnapshot, perQuestion: qResults || [], highlights: {} },
          });
        } catch { /* noop */ }
        saveExamResult({
          examSetId: set.id,
          skill: "listening",
          correct, total,
          perQuestion,
          reviewSnapshot: snap,
          extraSkillScores: { mode: "marathon-set", marathonSessionId: sessionIdRef.current, part: set.part },
        });
      })();
    }

    const nextResults = results.slice();
    nextResults[currentIndex] = entry;
    const isLastSet = currentIndex >= sets.length - 1;
    const pending = pendingJumpRef.current;
    pendingJumpRef.current = null;
    const nextIndex = pending
      ? Math.max(0, Math.min(pending.si, sets.length - 1))
      : (isLastSet ? currentIndex : currentIndex + 1);
    setResults(nextResults);
    setEnterAtLast(false);
    const nextDrafts = { ...drafts };
    delete nextDrafts[set.id];
    setDrafts(nextDrafts);
    if (persist) {
      saveMarathonProgress("listening", progPart, { currentIndex: nextIndex, results: nextResults as any, drafts: nextDrafts, sessionId: sessionIdRef.current, testResultId: testResultIdRef.current, updatedAt: Date.now() });
    }
    if (pending) {
      setJumpQ(pending.qi);
      setTimeout(() => setJumpQ(null), 0);
      setCurrentIndex(nextIndex);
    } else if (!isLastSet) {
      setCurrentIndex(nextIndex);
    } else {
      setPhase("completed");
    }
  }, [currentIndex, sets, results, persist, partType, drafts, loaded]);

  const partName =
    partType === "part1" ? "Part 1"
    : partType === "part2" ? "Part 2"
    : partType === "part3" ? "Part 3"
    : "Part 4";

  // Upsert single "Marathon · Part X" History row for this session.
  const persistHistoryRow = useCallback(async (opts?: { finalize?: boolean }) => {
    if (savingHistoryRef.current) return;
    const list = resultsRef.current;
    const reviewable_ = list.filter((r): r is ResultEntry => !!r);
    if (reviewable_.length === 0) return;
    const accCorrect_ = reviewable_.reduce((s, r) => s + (r.correct ?? 0), 0);
    const accTotal_ = reviewable_.reduce((s, r) => s + (r.total ?? 0), 0);
    if (accTotal_ === 0) return;
    savingHistoryRef.current = true;
    try {
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { buildListeningItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const items: any[] = [];
      reviewable_.forEach((r) => {
        const ed = loaded?.[sets.findIndex((s) => s.id === r.examSetId)]?.engineData ?? null;
        if (ed) {
          try { items.push(...buildListeningItems(partType as any, ed, {}, r.qResults || [])); }
          catch { /* noop */ }
        }
      });
      const { scaled50, band } = computeScaleAndBand("listening", accCorrect_, accTotal_);
      const snap = buildReviewSnapshot({
        skill: "listening",
        part: partType,
        testTitle: `Marathon · ${partName}`,
        score: accCorrect_, total: accTotal_,
        scaled50, band,
        items,
        raw: {
          mode: "marathon",
          partType,
          perSet: reviewable_.map((r) => ({
            examSetId: r.examSetId, part: r.part,
            correct: r.correct, total: r.total,
            qResults: r.qResults,
            engineData: loaded?.[sets.findIndex((s) => s.id === r.examSetId)]?.engineData ?? null,
          })),
        },
      });
      const id = await upsertMarathonResult({
        testResultId: testResultIdRef.current,
        sessionId: sessionIdRef.current,
        skill: "listening",
        correct: accCorrect_,
        total: accTotal_,
        extraSkillScores: {
          label: `Marathon · ${partName}`,
          partType,
          done: reviewable_.length,
          totalSets: sets.length,
        },
        reviewSnapshot: snap,
      });
      if (id) {
        testResultIdRef.current = id;
        if (persist) {
          saveMarathonProgress("listening", progPart, {
            currentIndex,
            results: list as any,
            drafts,
            sessionId: sessionIdRef.current,
            testResultId: id,
            updatedAt: Date.now(),
          });
        }
      }
      if (opts?.finalize && persist) {
        const wrongSetIds = reviewable_.filter((r) => r.qResults.some((q) => !q.is_correct)).map((r) => r.examSetId);
        const wrongQBySet: Record<string, string[]> = {};
        reviewable_.forEach((r) => {
          const wq = r.qResults.filter((q) => !q.is_correct).map((q) => q.exam_question_id);
          if (wq.length) wrongQBySet[r.examSetId] = wq;
        });
        saveMarathonLast("listening", progPart, { correct: accCorrect_, total: accTotal_, wrongSetIds, wrongQuestionsBySet: wrongQBySet, updatedAt: Date.now() });
        clearMarathonProgress("listening", progPart);
      }
    } finally {
      savingHistoryRef.current = false;
    }
  }, [partType, partName, sets, loaded, currentIndex, drafts, persist]);

  useEffect(() => {
    if (phase !== "completed" || savedOnce) return;
    setSavedOnce(true);
    persistHistoryRow({ finalize: true });
  }, [phase, savedOnce, persistHistoryRow]);

  const handleExitMarathon = useCallback(() => {
    persistHistoryRow();
    onExit();
  }, [persistHistoryRow, onExit]);

  const pendingExitRef = useRef<{ index: number; timer?: any } | null>(null);

  const handleMarathonSaveExit = useCallback(() => {
    const idx = currentIndex;
    const alreadySubmitted = !!resultsRef.current[idx];
    const hasAnswer = currentAnswered.some(Boolean);
    if (alreadySubmitted || !hasAnswer) {
      persistHistoryRow();
      onExit();
      return;
    }
    // Safety net: never trap the user if grading doesn't report back.
    const timer = setTimeout(() => {
      if (!pendingExitRef.current) return;
      pendingExitRef.current = null;
      persistHistoryRow();
      onExit();
    }, 2500);
    pendingExitRef.current = { index: idx, timer };
    setSubmitSignal((s) => s + 1);
  }, [currentIndex, currentAnswered, persistHistoryRow, onExit]);

  useEffect(() => {
    const pending = pendingExitRef.current;
    if (!pending) return;
    if (!results[pending.index]) return;
    if (pending.timer) clearTimeout(pending.timer);
    pendingExitRef.current = null;
    persistHistoryRow();
    onExit();
  }, [results, persistHistoryRow, onExit]);


  // Add body class while reviewing for any review-mode global styles.
  useEffect(() => {
    if (reviewIndex === null) return;
    document.body.classList.add("history-review-mode");
    return () => {
      document.body.classList.remove("history-review-mode");
    };
  }, [reviewIndex !== null]);


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

  if (loadErr) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName}`} onExit={onExit} />
        <ExamLoadErrorModal
          state={loadErr}
          onClose={() => { setLoadErr(null); onExit(); }}
          onRetry={() => { setLoadErr(null); setLoadTick((t) => t + 1); }}
        />
      </div>
    );
  }

  if (phase === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName}`} onExit={handleExitMarathon} />
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
              <Button variant="outline" onClick={handleExitMarathon}>Thoát</Button>
              {reviewable.length > 0 && (
                <Button variant="secondary" onClick={() => setReviewIndex(0)} className="gap-2">
                  <Eye className="w-4 h-4" /> Xem lại từng câu →
                </Button>
              )}
              <Button
                onClick={() => {
                  if (persist) clearMarathonProgress("listening", progPart);
                  setResults(new Array(sets.length).fill(undefined));
                  setReviewIndex(null);
                  setCurrentIndex(0);
                  setEnterAtLast(false);
                  setSavedOnce(false);
                  setPhase("loading");
                  setAttempt((a) => a + 1);
                  sessionIdRef.current = newMarathonSessionId();
                  testResultIdRef.current = null;
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
        <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName}`} onExit={handleExitMarathon} />
        <main className="flex-1 flex items-center justify-center">
          <div className="space-y-4 text-center">
            <TechSkeleton variant="circle" className="h-12 w-12 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Đang tải đề... {Math.min(loadProgress, sets.length)}/{sets.length}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const engineData = loaded[currentIndex]?.engineData;
  if (!engineData) return null;

  const currentSetId = sets[currentIndex]?.id;
  const draftForSet = currentSetId ? drafts[currentSetId] : undefined;

  // Rebuild initialAnswers for current set: prefer submitted qResults, else draft.
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
  } else if (Array.isArray(draftForSet) && draftForSet.length) {
    initialAnswers = draftForSet;
  }

  const persistAnswers = (a: any[]) => {
    const arr = Array.isArray(a) ? a : [];
    setCurrentAnswers(arr);
    if (!currentSetId) return;
    setDrafts((prev) => {
      const next = { ...prev, [currentSetId]: arr };
      if (persist) {
        saveMarathonProgress("listening", progPart, {
          currentIndex,
          results: results as any,
          drafts: next,
          sessionId: sessionIdRef.current,
          testResultId: testResultIdRef.current,
          updatedAt: Date.now(),
        });
      }
      return next;
    });
  };

  // Mục lục THEO MÀN HÌNH: ưu tiên pageCount thật của engine, fallback question_count.
  const qCounts = sets.map((s, i) => {
    const pc = loaded?.[i]?.pageCount;
    if (Number.isFinite(pc as any) && (pc as number) > 0) return pc as number;
    const n = Number((s as any).question_count);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });



  const midReviewEntry = midReview ? results[midReview.setIndex] : null;
  const midPageCount = midReviewEntry?.qResults.length ?? 0;

  // Shared "đi tới đề khác" logic, used by the navigator chips and the inline "Sau →" button.
  const goToSet = (si: number, qi: number) => {
    try {
      if (si < 0 || si >= sets.length) return;
      const max = Math.max(1, loaded[si]?.pageCount ?? 1) - 1;
      const clamped = Math.max(0, Math.min(qi, max));
      if (midReview) {
        setMidReview(null);
        setEnterAtLast(false);
        setJumpQ(clamped);
        setCurrentIndex(si);
        setTimeout(() => setJumpQ(null), 0);
        return;
      }
      // Per-question mode: only submit the set when EVERY question is done,
      // so unanswered questions are never graded as blank.
      const need = Math.max(1, loaded[currentIndex]?.pageCount ?? 1);
      const doneCount = currentAnswered.filter(Boolean).length;
      const allAnswered = doneCount >= need;
      if (allAnswered) {
        pendingJumpRef.current = { si, qi: clamped };
        setSubmitSignal((s) => s + 1);
        return;
      }
      setEnterAtLast(false);
      setJumpQ(clamped);
      setCurrentIndex(si);
      setTimeout(() => setJumpQ(null), 0);
    } catch { /* noop */ }
  };

  return (
    <div className="lg:flex lg:items-stretch min-h-screen">
      <div className="flex-1 min-w-0">
        {midReviewEntry ? (
          <HistoryReviewRenderer
            key={`mid-${midReview!.setIndex}-${midReview!.qIndex}`}
            examSetId={midReviewEntry.examSetId}
            skill="listening"
            part={midReviewEntry.part}
            testTitle={`Đề ${midReview!.setIndex + 1}${sets[midReview!.setIndex]?.title ? ` — ${sets[midReview!.setIndex]!.title}` : ""}`}
            qResults={midReviewEntry.qResults}
            onExit={() => setMidReview(null)}
            pageBase={0}
            pageTotal={midPageCount}
            initialSection={Math.min(midReview!.qIndex, Math.max(0, midPageCount - 1))}
            hideTimer
            hideBottomNav
            hideBackToResults
          />
        ) : (
          <ListeningExamEngine
            key={`${attempt}-${currentIndex}`}
            examSetId={sets[currentIndex]?.id ?? null}
            partType={partType}
            testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}${sets[currentIndex]?.title ? ` — ${sets[currentIndex]!.title}` : ""}`}
            timeLimit={HUGE_TIME}
            hideTimer
            skipIntro
            allowReveal
            reviewScopeNote={`Marathon · Đề ${currentIndex + 1}/${sets.length} — chỉ xét câu chưa làm của đề này`}
            onMarathonFinish={handleMarathonSaveExit}

            showResultsOnSubmit={false}
            onExit={handleExitMarathon}
            onComplete={handleComplete}
            onPreviousPart={() => {
              if (currentIndex > 0) {
                setEnterAtLast(true);
                setCurrentIndex((i) => i - 1);
              }
            }}
            onNavPrevSet={currentIndex > 0 ? () => {
              setEnterAtLast(true);
              setCurrentIndex((i) => i - 1);
            } : undefined}
            onNavNextSet={currentIndex < sets.length - 1 ? () => goToSet(currentIndex + 1, 0) : undefined}
            initialQuestion={
              jumpQ != null
                ? jumpQ
                : enterAtLast
                ? Math.max(1, loaded[currentIndex]?.pageCount ?? 1) - 1
                : undefined
            }
            initialAnswers={initialAnswers}
            onAnswersChange={persistAnswers}
            pageBase={pageBase}
            pageTotal={pageTotal}
            submitSignal={submitSignal}
            marathonLock
            onLockedChange={setCurrentLocked}
            unlockSignal={unlockSignal}
            hideBottomNav
            onQuestionChange={setCurrentQ}
            {...engineData}

          />
        )}
      </div>
      <MarathonNavigator
        sets={sets}
        results={results as any}
        currentIndex={currentIndex}
        reviewingIndex={midReview ? midReview.setIndex : null}
        reviewingQ={midReview ? midReview.qIndex : undefined}
        currentQ={currentQ}
        qCounts={qCounts}
        currentAnswered={currentAnswered}
        currentLocked={currentLocked}
        draftsBySet={drafts}
        isRetryMode={isRetryMode}
        chipLabelMode="question"
        showSetLabels

        allowJumpInCurrent
        onReview={(si, qi) => setMidReview({ setIndex: si, qIndex: qi })}
        onJumpQuestion={(qi) => {
          if (midReview) setMidReview(null);
          const max = Math.max(1, loaded[currentIndex]?.pageCount ?? 1) - 1;
          setJumpQ(Math.max(0, Math.min(qi, max)));
          setTimeout(() => setJumpQ(null), 0);
        }}
        onEnterSet={(si, qi) => goToSet(si, qi)}
        onRetryQuestion={(si, qi) => {
          try {
            if (si < 0 || si >= sets.length) return;
            // Same set, still in progress: just clear + unlock this question.
            if (si === currentIndex && !results[si] && !midReview) {
              setUnlockSignal((prev) => ({ qi, n: (prev?.n ?? 0) + 1 }));
              return;
            }
            // Submitted set: drop its result, keep other answers, reopen at this question.
            const setId = sets[si]?.id;
            const nextResults = results.slice();
            const entry = nextResults[si];
            nextResults[si] = undefined;
            setResults(nextResults);
            const nextDrafts = { ...drafts };
            if (setId) {
              const base: any[] = (drafts[setId] as any[])
                ?? (entry?.qResults ?? []).map((r) => {
                  if (!r.user_answer) return null;
                  try { const p2 = JSON.parse(r.user_answer); return p2?.answer ?? null; } catch { const nn = parseInt(r.user_answer, 10); return Number.isFinite(nn) ? nn : null; }
                });
              const cleaned = [...(base ?? [])];
              cleaned[qi] = null;
              nextDrafts[setId] = cleaned;
            }
            setDrafts(nextDrafts);
            if (persist) {
              saveMarathonProgress("listening", progPart, {
                currentIndex: si,
                results: nextResults as any,
                drafts: nextDrafts,
                sessionId: sessionIdRef.current,
                testResultId: testResultIdRef.current,
                updatedAt: Date.now(),
              });
            }
            setMidReview(null);
            setEnterAtLast(false);
            setJumpQ(qi);
            setCurrentIndex(si);
            setAttempt((a) => a + 1);
            setTimeout(() => setJumpQ(null), 0);
          } catch { /* noop */ }
        }}
      />
    </div>
  );
};


export default ListeningMarathonEngine;
