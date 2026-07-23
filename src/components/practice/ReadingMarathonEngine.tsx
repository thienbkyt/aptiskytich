import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReadingExamEngine, { type ReadingPartType } from "@/components/reading/ReadingExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import { Button } from "@/components/ui/button";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
} from "@/lib/examTransformers";
import { saveExamResult, upsertMarathonResult } from "@/lib/saveExamResult";
import { saveMarathonProgress, clearMarathonProgress, saveMarathonLast, loadMarathonProgress, newMarathonSessionId } from "@/lib/marathonProgress";
import { Trophy, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import MarathonNavigator from "@/components/practice/MarathonNavigator";

interface Props {
  sets: ExamSetRow[];
  partType: ReadingPartType;
  skillLabel: string;
  onExit: () => void;
  resume?: boolean;
  persist?: boolean;
  isRetryMode?: boolean;
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

const ReadingMarathonEngine = ({ sets, partType, skillLabel, onExit, resume = false, persist = true, isRetryMode = false }: Props) => {
  const savedInit = resume && persist ? loadMarathonProgress("reading", partType) : null;
  const [currentIndex, setCurrentIndex] = useState(savedInit?.currentIndex ?? 0);
  const [enterAtLast, setEnterAtLast] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [engineData, setEngineData] = useState<any>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, any>>(() => savedInit?.drafts ?? {});
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
  const [currentAnswers, setCurrentAnswers] = useState<any>(null);
  const [submitSignal, setSubmitSignal] = useState(0);
  const [currentLocked, setCurrentLocked] = useState<boolean[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const pendingJumpRef = useRef<{ si: number; qi: number } | null>(null);
  const questionsCacheRef = useRef<Map<string, any[]>>(new Map());
  const sessionIdRef = useRef<string>(savedInit?.sessionId ?? newMarathonSessionId());
  const testResultIdRef = useRef<string | null>(savedInit?.testResultId ?? null);
  const savingRef = useRef(false);
  const resultsRef = useRef<(ResultEntry | undefined)[]>(results);
  useEffect(() => { resultsRef.current = results; }, [results]);

  const buildEngineData = useCallback((questions: any[]) => {
    const data: any = { sourceQuestionIds: questions.map((q: any) => q.id) };
    switch (partType) {
      case "part1": data.part1Question = toReadingPart1(questions); break;
      case "part2": data.part2Question = toReadingPart2(questions); break;
      case "part3": data.part3Question = toReadingPart3(questions); break;
      case "part4": data.part4Question = toReadingPart4(questions); break;
    }
    return data;
  }, [partType]);

  useEffect(() => { setCurrentAnswers(null); setCurrentLocked([]); setActiveSection(0); }, [currentIndex, attempt]);

  // One navigator chip == one "màn hình câu hỏi" of a set.
  // Reading Part 2 (Cohesion) paginates its two sections; every other part is a single page.
  const pagesPerSet = partType === "part2" ? 2 : 1;

  const isAnsweredVal = (v: any): boolean => {
    if (v == null) return false;
    if (typeof v === "number") return v >= 0;
    if (typeof v === "string") return v !== "";
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return !!v;
  };

  const currentAnswered = useMemo(() => {
    const out: boolean[] = new Array(pagesPerSet).fill(false);
    try {
      const key = partType === "part1" ? "p1" : partType === "part2" ? "p2" : partType === "part3" ? "p3" : "p4";
      const bag = currentAnswers?.[key];
      if (partType === "part2") {
        // p2 is an array of Record<number,string> keyed by section.
        if (Array.isArray(bag)) {
          for (let i = 0; i < pagesPerSet; i++) out[i] = isAnsweredVal(bag[i]);
        }
      } else {
        const anyAns = Array.isArray(bag)
          ? bag.some(isAnsweredVal)
          : (bag && typeof bag === "object" ? Object.values(bag).some(isAnsweredVal) : false);
        out[0] = !!anyAns;
      }
    } catch { /* noop */ }
    return out;
  }, [currentAnswers, partType, pagesPerSet]);

  // Collapse engine's per-question locked array into chip-sized (pagesPerSet) form.
  const chipLocked = useMemo(() => {
    const out: boolean[] = new Array(pagesPerSet).fill(false);
    if (!currentLocked || currentLocked.length === 0) return out;
    if (partType === "part2") {
      for (let i = 0; i < pagesPerSet; i++) out[i] = !!currentLocked[i];
    } else {
      out[0] = currentLocked.length > 0 && currentLocked.every(Boolean);
    }
    return out;
  }, [currentLocked, partType, pagesPerSet]);


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

  const partName =
    partType === "part1" ? "Part 1"
    : partType === "part2" ? "Part 2 + 3"
    : partType === "part3" ? "Part 4"
    : "Part 5";

  useEffect(() => {
    if (currentIndex >= sets.length) return;
    const set = sets[currentIndex];
    const cached = questionsCacheRef.current.get(set.id);
    if (cached) {
      // Instant switch — no loading state, no network.
      setEngineData(buildEngineData(cached));
      setPhase("exam");
      // Prefetch the next set into cache for an instant next hop.
      const nextSet = sets[currentIndex + 1];
      if (nextSet && !questionsCacheRef.current.has(nextSet.id)) {
        fetchExamQuestions(nextSet.id)
          .then((qs) => { questionsCacheRef.current.set(nextSet.id, qs); })
          .catch(() => { /* noop */ });
      }
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setEngineData(null);
    (async () => {
      const questions = await fetchExamQuestions(set.id);
      if (cancelled) return;
      questionsCacheRef.current.set(set.id, questions);
      setEngineData(buildEngineData(questions));
      setPhase("exam");
      // Prefetch neighbor after first paint.
      const nextSet = sets[currentIndex + 1];
      if (nextSet && !questionsCacheRef.current.has(nextSet.id)) {
        fetchExamQuestions(nextSet.id)
          .then((qs) => { if (!cancelled) questionsCacheRef.current.set(nextSet.id, qs); })
          .catch(() => { /* noop */ });
      }
    })();
    return () => { cancelled = true; };
  }, [currentIndex, sets, partType, buildEngineData]);

  const handleComplete = useCallback((correct: number, total: number, perQuestion?: any[]) => {
    const set = sets[currentIndex];
    const qResults: QResult[] = Array.isArray(perQuestion) ? (perQuestion as QResult[]) : [];
    let answers: any = [];
    try {
      const raw = qResults[0]?.user_answer;
      if (raw) { const parsed = JSON.parse(raw); answers = parsed?.answers ?? []; }
    } catch { /* noop */ }
    const entry: ResultEntry = { correct, total, examSetId: set.id, part: set.part, qResults, answers } as any;
    const nextResults = results.slice();
    nextResults[currentIndex] = entry;
    const isLastSet = currentIndex >= sets.length - 1;
    // Prefer a pending navigator jump when present, else advance sequentially.
    const pending = pendingJumpRef.current;
    pendingJumpRef.current = null;
    const nextIndex = pending
      ? Math.max(0, Math.min(pending.si, sets.length - 1))
      : (isLastSet ? currentIndex : currentIndex + 1);
    setResults(nextResults);
    // Drop the draft for this set now that it's submitted.
    const nextDrafts = { ...drafts };
    delete nextDrafts[set.id];
    setDrafts(nextDrafts);
    if (persist) saveMarathonProgress("reading", partType, { currentIndex: nextIndex, results: nextResults as any, drafts: nextDrafts, updatedAt: Date.now() });
    if (pending) {
      setEnterAtLast(false);
      setJumpQ(pending.qi);
      setTimeout(() => setJumpQ(null), 0);
      setCurrentIndex(nextIndex);
    } else if (!isLastSet) {
      setEnterAtLast(false);
      setCurrentIndex(nextIndex);
    } else {
      setPhase("completed");
    }
  }, [currentIndex, sets, results, persist, partType]);

  // Build a snapshot + upsert the single per-session History row. Called from
  // completed effect and from exit — same row is updated across both paths.
  const persistHistoryRow = useCallback(async (opts?: { finalize?: boolean }) => {
    if (savingRef.current) return;
    const list = resultsRef.current;
    const reviewable_ = list.filter((r): r is ResultEntry => !!r);
    if (reviewable_.length === 0) return;
    const accCorrect_ = reviewable_.reduce((s, r) => s + (r.correct ?? 0), 0);
    const accTotal_ = reviewable_.reduce((s, r) => s + (r.total ?? 0), 0);
    if (accTotal_ === 0) return;
    savingRef.current = true;
    try {
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const items: any[] = reviewable_.map((r) => ({
        questionText: `Đề ${r.examSetId} · ${r.part}`,
        userAnswer: `${r.correct}/${r.total}`,
        isCorrect: r.correct === r.total,
      }));
      const { scaled50, band } = computeScaleAndBand("reading", accCorrect_, accTotal_);
      const snap = buildReviewSnapshot({
        skill: "reading",
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
            qResults: r.qResults, answers: r.answers,
          })),
        },
      });
      const id = await upsertMarathonResult({
        testResultId: testResultIdRef.current,
        sessionId: sessionIdRef.current,
        skill: "reading",
        correct: accCorrect_,
        total: accTotal_,
        extraSkillScores: {
          label: `Marathon · ${partName}`,
          done: reviewable_.length,
          totalSets: sets.length,
        },
        reviewSnapshot: snap,
      });
      if (id) {
        testResultIdRef.current = id;
        if (persist) {
          saveMarathonProgress("reading", partType, {
            currentIndex: resultsRef.current === list ? currentIndex : currentIndex,
            results: list as any,
            drafts,
            sessionId: sessionIdRef.current,
            testResultId: id,
            updatedAt: Date.now(),
          });
        }
      }
      if (opts?.finalize && persist) {
        const wrongSetIds = reviewable_.filter((r) => r.correct < r.total).map((r) => r.examSetId);
        saveMarathonLast("reading", partType, { correct: accCorrect_, total: accTotal_, wrongSetIds, updatedAt: Date.now() });
        clearMarathonProgress("reading", partType);
      }
    } finally {
      savingRef.current = false;
    }
  }, [partType, partName, sets.length, currentIndex, drafts, persist]);

  useEffect(() => {
    if (phase !== "completed" || savedOnce) return;
    setSavedOnce(true);
    persistHistoryRow({ finalize: true });
  }, [phase, savedOnce, persistHistoryRow]);

  const handleExitMarathon = useCallback(() => {
    // Fire-and-forget the save so leaving is instant. If it fails the user
    // can retry — but the History row will still exist from earlier saves.
    persistHistoryRow();
    onExit();
  }, [persistHistoryRow, onExit]);

  useEffect(() => {
    if (reviewIndex === null) return;
    document.body.classList.add("history-review-mode");
    return () => {
      document.body.classList.remove("history-review-mode");
    };
  }, [reviewIndex !== null]);




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
                  if (persist) clearMarathonProgress("reading", partType);
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

  // Prefer submitted answers when present, else fall back to per-set draft.
  const currentSetId = sets[currentIndex]?.id;
  const savedFromResult = results[currentIndex]?.answers;
  const draftForSet = currentSetId ? drafts[currentSetId] : undefined;
  const initialAnswers: any = {};
  const rawInit = savedFromResult !== undefined ? savedFromResult : draftForSet;
  if (rawInit !== undefined) {
    if (partType === "part1") initialAnswers.p1 = rawInit;
    else if (partType === "part2") initialAnswers.p2 = rawInit;
    else if (partType === "part3") initialAnswers.p3 = rawInit;
    else if (partType === "part4") initialAnswers.p4 = rawInit;
  }

  const midReviewEntry = midReview ? results[midReview.setIndex] : null;

  // One chip per "màn hình câu hỏi" of a set (pagesPerSet).
  const qCounts = sets.map(() => pagesPerSet);

  const persistAnswers = (a: any) => {
    setCurrentAnswers(a);
    // Extract raw per-part bag, then persist as a draft so a reload restores partial work.
    if (!currentSetId) return;
    const key = partType === "part1" ? "p1" : partType === "part2" ? "p2" : partType === "part3" ? "p3" : "p4";
    const bag = a?.[key];
    setDrafts((prev) => {
      const next = { ...prev, [currentSetId]: bag };
      if (persist) {
        saveMarathonProgress("reading", partType, {
          currentIndex,
          results: results as any,
          drafts: next,
          updatedAt: Date.now(),
        });
      }
      return next;
    });
  };

  return (
    <div className="lg:flex lg:items-stretch min-h-screen">
      <div className="flex-1 min-w-0">
        {midReviewEntry ? (
          <HistoryReviewRenderer
            key={`mid-${midReview!.setIndex}-${midReview!.qIndex}`}
            examSetId={midReviewEntry.examSetId}
            skill="reading"
            part={midReviewEntry.part}
            testTitle={`Đề ${midReview!.setIndex + 1}`}
            qResults={midReviewEntry.qResults}
            onExit={() => setMidReview(null)}
            pageBase={0}
            pageTotal={pagesPerSet}
            initialSection={Math.min(midReview!.qIndex, pagesPerSet - 1)}
            hideTimer
            hideBottomNav
            hideBackToResults
          />
        ) : (
          <ReadingExamEngine
            key={`${attempt}-${currentIndex}`}
            partType={partType}
            testTitle={`${partName} · Đề ${currentIndex + 1}/${sets.length}`}
            timeLimit={HUGE_TIME}
            hideTimer
            skipIntro
            allowReveal={true}
            reviewScopeNote={`Marathon · Đề ${currentIndex + 1}/${sets.length} — chỉ xét câu chưa làm của đề này`}
            showResultsOnSubmit={false}
            onExit={onExit}
            onComplete={handleComplete}
            onMarathonFinish={() => setPhase("completed")}
            onPreviousPart={() => {
              if (currentIndex > 0) {
                setEnterAtLast(true);
                setCurrentIndex((i) => i - 1);
              }
            }}
            enterAtLastQuestion={enterAtLast}
            initialAnswers={initialAnswers}
            onAnswersChange={persistAnswers}
            onSectionChange={setActiveSection}
            pageBase={currentIndex * pagesPerSet}
            pageTotal={sets.length * pagesPerSet}
            initialSection={jumpQ ?? undefined}
            submitSignal={submitSignal}
            marathonLock
            hideBottomNav
            onLockedChange={setCurrentLocked}
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
        currentQ={activeSection}
        qCounts={qCounts}
        currentAnswered={currentAnswered}
        currentLocked={chipLocked}
        isRetryMode={isRetryMode}
        onReview={(si, qi) => setMidReview({ setIndex: si, qIndex: qi })}
        onJumpQuestion={(qi) => {
          if (midReview) setMidReview(null);
          const clamped = Math.max(0, Math.min(qi, pagesPerSet - 1));
          setJumpQ(clamped);
          setTimeout(() => setJumpQ(null), 0);
        }}
        onEnterSet={(si, qi) => {
          try {
            if (si < 0 || si >= sets.length) return;
            const clamped = Math.max(0, Math.min(qi, pagesPerSet - 1));
            if (midReview) {
              setMidReview(null);
              setEnterAtLast(false);
              setJumpQ(clamped);
              setCurrentIndex(si);
              setTimeout(() => setJumpQ(null), 0);
              return;
            }
            const hasAnyAnswer = currentAnswered.some(Boolean);
            if (hasAnyAnswer) {
              // Auto-submit the current in-progress set, then jump.
              pendingJumpRef.current = { si, qi: clamped };
              setSubmitSignal((s) => s + 1);
              return;
            }
            setEnterAtLast(false);
            setJumpQ(clamped);
            setCurrentIndex(si);
            setTimeout(() => setJumpQ(null), 0);
          } catch { /* noop */ }
        }}
        onRetrySet={(si) => {
          try {
            if (si < 0 || si >= sets.length) return;
            const setId = sets[si]?.id;
            const nextResults = results.slice();
            nextResults[si] = undefined;
            setResults(nextResults);
            const nextDrafts = { ...drafts };
            if (setId) delete nextDrafts[setId];
            setDrafts(nextDrafts);
            if (persist) {
              saveMarathonProgress("reading", partType, {
                currentIndex: si,
                results: nextResults as any,
                drafts: nextDrafts,
                updatedAt: Date.now(),
              });
            }
            setMidReview(null);
            setEnterAtLast(false);
            setJumpQ(0);
            setCurrentIndex(si);
            setAttempt((a) => a + 1);
            setTimeout(() => setJumpQ(null), 0);
          } catch { /* noop */ }
        }}
      />
    </div>
  );
};


export default ReadingMarathonEngine;
