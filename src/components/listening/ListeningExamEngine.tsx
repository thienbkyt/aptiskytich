import { useState, useEffect, useCallback, useRef } from "react";
import { markExamActive } from "@/lib/examActive";
import ExamHeader from "@/components/exam/ExamHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import { resetLimitedAudioPlays } from "@/components/exam/LimitedAudioPlayer";
import { resolveAudioUrls } from "@/lib/audioUrl";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ListeningPart1Word from "@/components/listening/ListeningPart1Word";
import ListeningPart2Match from "@/components/listening/ListeningPart2Match";
import ListeningPart3Conversation from "@/components/listening/ListeningPart3Conversation";
import ListeningPart4Monologue from "@/components/listening/ListeningPart4Monologue";
import ListeningResults from "@/components/listening/ListeningResults";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import RevealAnswerButton from "@/components/exam/RevealAnswerButton";
import TimerDisplay from "@/components/reading/TimerDisplay";
import { TimerProvider } from "@/components/reading/TimerContext";
import PausedTimeNotice from "@/components/exam/PausedTimeNotice";
import { useCountdown } from "@/hooks/useCountdown";
// Render dedicated results screen after submission when showResultsOnSubmit is true.
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";
import { useListeningHighlightData } from "@/hooks/useListeningHighlightData";
import type { ListeningHighlightData } from "@/lib/listeningReview";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useMarathonArrowKeys } from "@/hooks/useMarathonArrowKeys";
import RotateDeviceOverlay from "@/components/exam/RotateDeviceOverlay";
import { Button } from "@/components/ui/button";

export type ListeningPartType = "part1" | "part2" | "part3" | "part4";

export interface ListeningPerQuestion {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface ListeningExamEngineProps {
  partType: ListeningPartType;
  testTitle: string;
  timeLimit: number;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
  onExit: () => void;
  onComplete?: (correct: number, total: number, perQuestion?: ListeningPerQuestion[]) => void;
  onPreviousPart?: () => void;
  externalTimeLeft?: number;
  onTimeTick?: (t: number) => void;
  isPaused?: boolean;
  allowPause?: boolean;
  onTogglePause?: () => void;
  skipIntro?: boolean;
  fullFlow?: boolean;
  /** When true, render ListeningResults after submission instead of locked review. */
  showResultsOnSubmit?: boolean;
  /** DB exam_questions.id list for this part — used to persist per-question results. */
  sourceQuestionIds?: string[];
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  initialAnswers?: any[];
  onAnswersChange?: (answers: any[]) => void;
  /** When provided, use parent-supplied highlight data; otherwise engine self-fetches in review. */
  highlightData?: ListeningHighlightData | null;
  highlightLoading?: boolean;
  examSetId?: string | null;
  hideTimer?: boolean;
  pageBase?: number;
  pageTotal?: number;
  /** Marathon: hide BottomNavBar (Previous/Next) and use the compact inline bar instead. */
  hideBottomNav?: boolean;
  /** Notifies parent of the active question index (used by marathon navigator). */
  onQuestionChange?: (i: number) => void;
  initialQuestion?: number;
  /** Notifies parent of total question count for this part (used by review pager). */
  onQuestionCount?: (n: number) => void;
  /** Practice-only: show "Hiện đáp án" button to reveal answers without submitting. Default false. */
  allowReveal?: boolean;
  /** When true (and not reviewMode), open this part at the last question (used when navigating Back from next part). */
  enterAtLastQuestion?: boolean;
  reviewScopeNote?: string;
  onMarathonFinish?: () => void;
  /** Marathon: bump to force submit the current in-progress set. */
  submitSignal?: number;
  /** Marathon: auto-lock/grade each question upon answering (per-question mode). */
  marathonLock?: boolean;
  /** Marathon: notifies parent of per-question locked flags for this part. */
  onLockedChange?: (locked: boolean[]) => void;
  /** Marathon: bump `n` to clear + unlock question `qi` (Làm lại câu này). */
  unlockSignal?: { qi: number; n: number } | null;
  /** Marathon: go to the previous exam set (used at the first question). */
  onNavPrevSet?: () => void;
  /** Marathon: go to the next exam set (used at the last question). */
  onNavNextSet?: () => void;
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
  onExit, onComplete, onPreviousPart, externalTimeLeft, onTimeTick, isPaused: isPausedProp, allowPause = true, onTogglePause: onTogglePauseProp, skipIntro, fullFlow,
  showResultsOnSubmit = false, sourceQuestionIds, reviewMode, initialAnswers, onAnswersChange,
  highlightData, highlightLoading, examSetId, hideTimer = false, pageBase, pageTotal, initialQuestion, onQuestionCount,
  hideBottomNav = false, onQuestionChange,
  allowReveal = false,
  enterAtLastQuestion = false,
  reviewScopeNote,
  onMarathonFinish,
  submitSignal,
  marathonLock = false,
  onLockedChange,
  unlockSignal,
  onNavPrevSet,
  onNavNextSet,
}: ListeningExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode || enterAtLastQuestion) ? "practice" : "instructions");
  const [currentIndex, setCurrentIndex] = useState(initialQuestion ?? 0);
  const [submitted, setSubmitted] = useState(!!reviewMode);
  const [isPausedInternal, setIsPausedInternal] = useState(false);
  const isPaused = allowPause === false ? false : (isPausedProp ?? isPausedInternal);
  const togglePause = allowPause === false ? undefined : (onTogglePauseProp ?? (() => setIsPausedInternal((p) => !p)));
  const [seenQuestions, setSeenQuestions] = useState<Set<number>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [resultStats, setResultStats] = useState<{ correct: number; total: number } | null>(null);
  const [isReviewing, setIsReviewing] = useState(!!reviewMode);
  const [hasStarted, setHasStarted] = useState<boolean>(skipIntro || !!reviewMode || !!enterAtLastQuestion);
  const [revealedIdx, setRevealedIdx] = useState<Set<number>>(new Set());
  const [lockedIdx, setLockedIdx] = useState<Set<number>>(new Set());
  useEffect(() => markExamActive(), []);
  // Batch-sign every audio file of this part in ONE storage request so the
  // players (13 in Part 1) hit a warm cache instead of firing 13+ sign calls.
  useEffect(() => {
    const paths: (string | null | undefined)[] = [];
    part1Questions?.forEach((q) => { paths.push(q.audioUrl, q.audioUrl2); });
    part2Questions?.forEach((q) => {
      paths.push(q.audioUrl, q.audioUrl2);
      q.persons?.forEach((p) => paths.push(p.audioUrl));
    });
    part3Questions?.forEach((q) => { paths.push(q.audioUrl, q.audioUrl2); });
    part4Questions?.forEach((c) => { paths.push(c.audioUrl, c.audioUrl2); });
    if (paths.some(Boolean)) void resolveAudioUrls(paths);
  }, [partType, part1Questions, part2Questions, part3Questions, part4Questions]);

  // Reset reveal whenever partType changes (engine instance reused in full-flow).
  useEffect(() => { setRevealedIdx(new Set()); }, [partType]);
  const isRevealedHere = allowReveal && !submitted && !reviewMode && revealedIdx.has(currentIndex);
  // Reveal is display-only; navigation always uses real `submitted`.
  const toggleRevealHere = () => {
    setRevealedIdx((prev) => {
      const n = new Set(prev);
      if (n.has(currentIndex)) n.delete(currentIndex);
      else n.add(currentIndex);
      return n;
    });
  };

  useEffect(() => {
    if (phase === "practice") setHasStarted(true);
  }, [phase]);
  useEffect(() => { onQuestionChange?.(currentIndex); }, [currentIndex, onQuestionChange]);
  useExitWarning(hasStarted && !submitted && !reviewMode);

  const toggleBookmark = useCallback((qi: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(qi)) next.delete(qi);
      else next.add(qi);
      return next;
    });
  }, []);

  const totalQuestions =
    partType === "part1" ? (part1Questions?.length || 0) :
    partType === "part2" ? (part2Questions?.length || 0) :
    partType === "part3" ? (part3Questions?.length || 0) :
    (part4Questions?.length || 0);

  // Notify parent of question count for this part (review pager support).
  useEffect(() => {
    onQuestionCount?.(Math.max(1, totalQuestions));
  }, [partType, totalQuestions, onQuestionCount]);

  // When initialQuestion changes (review pager navigates), sync currentIndex.
  useEffect(() => {
    if (initialQuestion != null) setCurrentIndex(initialQuestion);
  }, [initialQuestion]);

  // On initial mount, if asked, jump to last question of the part (used when navigating back from next part).
  useEffect(() => {
    if (enterAtLastQuestion && !reviewMode && totalQuestions > 0) {
      setCurrentIndex(totalQuestions - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  const [answers, setAnswers] = useState<any[]>(
    initialAnswers && initialAnswers.length === totalQuestions
      ? initialAnswers
      : new Array(totalQuestions).fill(null)
  );

  useEffect(() => {
    if (reviewMode) return;
    onAnswersChange?.(answers);
  }, [answers, reviewMode, onAnswersChange]);

  // Internal fetch: only if parent did not supply highlightData and we're in submitted/review state.
  const cacheKey = examSetId ?? sourceQuestionIds?.[0] ?? null;
  const internalFetchEnabled =
    highlightData === undefined && !!cacheKey && (submitted || !!reviewMode || revealedIdx.size > 0);
  const partSnapshot = {
    partType,
    part1Questions,
    part2Questions,
    part3Questions,
    part4Questions,
  };
  const { data: internalHighlight, status: internalHighlightStatus } = useListeningHighlightData(
    cacheKey,
    partSnapshot,
    internalFetchEnabled,
  );
  const effectiveHighlight = highlightData !== undefined ? highlightData : internalHighlight;
  const effectiveHighlightLoading =
    highlightData !== undefined ? !!highlightLoading : internalHighlightStatus === "loading";
  const highlights = effectiveHighlight?.highlights ?? {};

  useEffect(() => {
    if (phase === "practice") {
      setSeenQuestions((prev) => new Set(prev).add(currentIndex));
    }
  }, [phase, currentIndex]);

  const didMountRef = useRef(false);

  // Reset internal state when partType changes (full-test flow keeps engine mounted).
  // Skip in reviewMode so pre-filled answers aren't wiped.
  useEffect(() => {
    if (reviewMode) return;
    if (!didMountRef.current) { didMountRef.current = true; return; }
    setPhase(skipIntro ? "practice" : "instructions");
    setCurrentIndex(0);
    setSubmitted(false);
    setSeenQuestions(new Set());
    setAnswers(new Array(totalQuestions).fill(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partType]);

  // Reset audio play counts once on mount for a fresh attempt.
  useEffect(() => {
    if (!reviewMode) {
      resetLimitedAudioPlays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSetId]);

  const { timeLeft, pausedMs, restart: restartTimer } = useCountdown({
    totalSeconds: timeLimit,
    initialLeft: externalTimeLeft,
    running: hasStarted && !submitted && !hideTimer,
    paused: isPaused,
    onTick: onTimeTick,
  });

  useEffect(() => {
    if (hideTimer) return;
    if (hasStarted && !submitted && timeLeft <= 0) handleSubmit();
  }, [hasStarted, submitted, timeLeft, hideTimer]);

  // Marathon: parent bumps submitSignal to auto-submit current set before jumping.
  // Guard with a ref so a stale non-zero value at mount doesn't auto-submit a fresh set.
  const lastSubmitSignalRef = useRef<number>(submitSignal ?? 0);
  useEffect(() => {
    const s = submitSignal ?? 0;
    if (s <= lastSubmitSignalRef.current) return;
    lastSubmitSignalRef.current = s;
    if (submitted) return;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitSignal]);

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
    setResultStats({ correct, total: totalForScore });
    // Build perQuestion: 1 row per DB source question. Listening Part1 is 1:1;
    // Parts 2/3/4 compress all sub-answers per audio clip into one DB row, so
    // we serialize the user's answer object for that clip.
    let perQuestion: ListeningPerQuestion[] | undefined;
    if (sourceQuestionIds && sourceQuestionIds.length > 0) {
      if (partType === "part1" && part1Questions) {
        perQuestion = part1Questions.map((q, i) => ({
          exam_question_id: sourceQuestionIds[i] ?? sourceQuestionIds[0],
          user_answer: answers[i] != null ? String(answers[i]) : null,
          is_correct: answers[i] === q.correct,
        }));
      } else {
        // 1 row per DB question; sourceQuestionIds[i] aligns to nth clip/exercise
        const groupCount =
          partType === "part2" ? (part2Questions?.length || 1)
          : partType === "part3" ? (part3Questions?.length || 1)
          : (part4Questions?.length || 1);
        perQuestion = Array.from({ length: Math.min(groupCount, sourceQuestionIds.length) }, (_, i) => {
          const ans = answers[i];
          let groupCorrect = false;
          if (partType === "part2" && part2Questions?.[i]) {
            const q = part2Questions[i];
            const a = (ans || {}) as Record<string, string>;
            groupCorrect = q.persons.every((p) => {
              const item = q.infoItems.find((it) => it.correctPerson === p.name);
              return item ? a[p.name] === item.text : true;
            });
          } else if (partType === "part3" && part3Questions?.[i]) {
            const q = part3Questions[i];
            const a = (ans || {}) as Record<number, string>;
            groupCorrect = q.statements.every((s, si) => a[si] === s.correctAnswer);
          } else if (partType === "part4" && part4Questions?.[i]) {
            const c = part4Questions[i];
            const a = (ans || {}) as Record<number, number>;
            groupCorrect = c.questions.every((qq, qi) => a[qi] === qq.correct);
          }
          return {
            exam_question_id: sourceQuestionIds[i] ?? sourceQuestionIds[0],
            user_answer: JSON.stringify({ partType, answer: ans ?? null }),
            is_correct: groupCorrect,
          };
        });
      }
    }
    onComplete?.(correct, totalForScore, perQuestion);
  }, [partType, part1Questions, part2Questions, part3Questions, part4Questions, answers, totalQuestions, onComplete, sourceQuestionIds]);

  const handleRetry = () => {
    setSubmitted(false);
    setResultStats(null);
    setPhase("practice");
    setCurrentIndex(0);
    restartTimer(timeLimit);
    setSeenQuestions(new Set());
    setBookmarked(new Set());
    setAnswers(new Array(totalQuestions).fill(null));
    resetLimitedAudioPlays();
  };

  // Marathon per-question mode: a question counts as complete when every
  // sub-item of that screen has an answer.
  const isQuestionComplete = useCallback((qi: number, ans: any): boolean => {
    if (ans == null) return false;
    if (partType === "part1") return typeof ans === "number" && ans >= 0;
    if (partType === "part2") {
      const q = part2Questions?.[qi];
      if (!q) return false;
      const a = (ans || {}) as Record<string, string>;
      return q.persons.every((p) => !!a[p.name]);
    }
    if (partType === "part3") {
      const q = part3Questions?.[qi];
      if (!q) return false;
      const a = (ans || {}) as Record<number, string>;
      return q.statements.every((_, si) => !!a[si]);
    }
    const c = part4Questions?.[qi];
    if (!c) return false;
    const a = (ans || {}) as Record<number, number>;
    return c.questions.every((_, i) => a[i] != null);
  }, [partType, part2Questions, part3Questions, part4Questions]);

  // Pre-lock questions already completed when re-entering a set with drafts.
  const didPrelockRef = useRef(false);
  useEffect(() => {
    if (!marathonLock || reviewMode || didPrelockRef.current) return;
    if (!answers || answers.length === 0) return;
    didPrelockRef.current = true;
    const next = new Set<number>();
    answers.forEach((a, i) => { if (isQuestionComplete(i, a)) next.add(i); });
    if (next.size > 0) setLockedIdx(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marathonLock, reviewMode, answers.length]);

  // Notify parent of per-question locked flags.
  useEffect(() => {
    if (!onLockedChange) return;
    const arr = new Array(totalQuestions).fill(false);
    lockedIdx.forEach((i) => { if (i >= 0 && i < totalQuestions) arr[i] = true; });
    onLockedChange(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedIdx, totalQuestions]);

  // Marathon: "Làm lại câu này" — clear + unlock exactly one question.
  const lastUnlockRef = useRef<number>(unlockSignal?.n ?? 0);
  useEffect(() => {
    const n = unlockSignal?.n ?? 0;
    if (n <= lastUnlockRef.current) return;
    lastUnlockRef.current = n;
    const qi = unlockSignal?.qi ?? 0;
    setLockedIdx((prev) => { const s2 = new Set(prev); s2.delete(qi); return s2; });
    setAnswers((prev) => { const arr = [...prev]; arr[qi] = null; return arr; });
    setRevealedIdx((prev) => { const s2 = new Set(prev); s2.delete(qi); return s2; });
    setCurrentIndex(qi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockSignal?.n]);

  const handleAnswer = (qi: number, ai: any) => {
    if (submitted) return;
    if (marathonLock && lockedIdx.has(qi)) return;
    const n = [...answers];
    n[qi] = ai;
    setAnswers(n);
    if (marathonLock && isQuestionComplete(qi, ai)) {
      setLockedIdx((prev) => new Set(prev).add(qi));
    }
  };

  const isLockedHere = marathonLock && lockedIdx.has(currentIndex);

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
        attempted: answers[qi] !== null && answers[qi] !== undefined,
        bookmarked: bookmarked.has(qi),
        isCurrent: phase === "practice" && currentIndex === qi,
        onClick: () => { setPhase("practice"); setCurrentIndex(qi); },
      })),
    },
  ];

  const navProps = {
    onPrevious: currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : (onPreviousPart ?? (() => setPhase("listening_intro"))),
    onNext: currentIndex < totalQuestions - 1
      ? () => setCurrentIndex((p) => p + 1)
      : (!submitted ? handleSubmit : undefined),
    onSubmit: undefined,
    isFirst: false,
    isLast: false,
    sections,
    onSubmitTest: !submitted ? handleSubmit : undefined,
  };

  // Marathon mode (bottom nav hidden): ← → move between questions, crossing sets at the edges.
  const arrowPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((p) => Math.max(0, p - 1));
    else onNavPrevSet?.();
  }, [currentIndex, onNavPrevSet]);
  const arrowNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1));
    else onNavNextSet?.();
  }, [currentIndex, totalQuestions, onNavNextSet]);
  useMarathonArrowKeys({
    enabled: hideBottomNav && phase === "practice",
    onPrev: arrowPrev,
    onNext: arrowNext,
  });


  const adminControls = !submitted && !reviewMode ? (
    <AdminExamControls
      label={
        phase === "instructions"
          ? "Listening · Hướng dẫn"
          : phase === "listening_intro"
          ? "Listening · Bắt đầu"
          : `Listening · Câu ${currentIndex + 1}/${totalQuestions || 1}`
      }
      onSkip={() => {
        if (phase === "instructions") setPhase("listening_intro");
        else if (phase === "listening_intro") setPhase("practice");
        else if (currentIndex < totalQuestions - 1) setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1));
        else handleSubmit();
      }}
      onBack={
        phase === "instructions"
          ? onPreviousPart
          : phase === "listening_intro"
          ? () => setPhase("instructions")
          : currentIndex > 0
          ? () => setCurrentIndex((p) => Math.max(0, p - 1))
          : onPreviousPart
      }
    />
  ) : null;

  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <RotateDeviceOverlay />
        {adminControls}
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        {hasStarted && !hideTimer && (
          <div className="px-6 pt-3 flex justify-end">
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} isPaused={isPaused} onTogglePause={togglePause} hideTimer={hideTimer} />
          </div>
        )}
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
        <RotateDeviceOverlay />
        {adminControls}
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <div className="flex-1 bg-white pl-[80px] pr-[80px] pt-[40px] font-sans text-black">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-xl">Aptis General Listening Instructions</h1>
            {hasStarted && !hideTimer && <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} isPaused={isPaused} onTogglePause={togglePause} hideTimer={hideTimer} />}
          </div>
          <p className="font-bold mb-2">Listening</p>
          {fullFlow && (
            <p className="text-sm mb-1">You will listen to seventeen recordings.</p>
          )}
          <p className="text-sm mb-1">Click on the PLAY button to listen to each recording.</p>
          <p className="text-sm mb-1">You can listen to each recording TWO TIMES ONLY.</p>
          <p className="text-sm mb-1">
            You have {Math.ceil(timeLimit / 60)} minutes to complete {fullFlow ? "the test" : "this part"}.
          </p>
          <p className="text-sm mb-1">&nbsp;</p>
          <p className="text-sm">When you click on the 'Next' button, the test will begin.</p>
        </div>
        <BottomNavBar
          isFirst={false}
          onPrevious={() => setPhase("instructions")}
          onNext={() => setPhase("practice")}
          sections={sections}
          isInstructionsPhase
          onProceedFromInstructions={() => setPhase("practice")}
          reviewScopeNote={reviewScopeNote}
        />
      </div>
    );
  }


  if (phase === "review" && showResultsOnSubmit && resultStats && !isReviewing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RotateDeviceOverlay />
        <ExamHeader skillLabel="Listening" partLabel={partLabel} onExit={onExit} />
        <main className="flex-1 py-10 px-4">
          <PausedTimeNotice pausedMs={pausedMs} />
          <ListeningResults
            correct={resultStats.correct}
            total={resultStats.total}
            partLabel={`${testTitle} – ${partLabel}`}
            onExit={onExit}
            onRetry={handleRetry}
            onReview={() => { setIsReviewing(true); setCurrentIndex(0); }}
            partType={partType}
            part1Questions={part1Questions}
            part2Questions={part2Questions}
            part3Questions={part3Questions}
            part4Questions={part4Questions}
            userAnswers={answers}
          />
        </main>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(0, totalQuestions - 1));

  return (
    <TimerProvider timeLeft={timeLeft} totalTime={timeLimit} isPaused={isPaused} togglePause={togglePause}>
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <RotateDeviceOverlay />
      {adminControls}
      {!submitted && !reviewMode && (
        <ExamReportButton
          examQuestionId={sourceQuestionIds?.[currentIndex] ?? sourceQuestionIds?.[0] ?? null}
          examSetId={examSetId ?? null}
          skill="listening"
          partType={partType}
          questionNumber={currentIndex + 1}
        />
      )}
      {allowReveal && !submitted && !reviewMode && (
        <RevealAnswerButton revealed={isRevealedHere} onToggle={toggleRevealHere} />
      )}
      <ExamHeader
        skillLabel="Listening"
        partLabel={partLabel}
        onExit={onExit}
        onMarathonFinish={onMarathonFinish}
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
      <div className="flex-1 px-4 pt-4 sm:pt-8 pb-28 sm:pb-24 max-w-3xl mx-auto w-full">
        {partType === "part1" && part1Questions && (
          <ListeningPart1Word
            questions={part1Questions}
            currentIndex={safeIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            revealAnswers={isRevealedHere || isLockedHere}
            onAnswer={handleAnswer}
            {...navProps}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={() => toggleBookmark(currentIndex)}
            highlights={highlights}
            highlightLoading={effectiveHighlightLoading}
            hideTimer={hideTimer}
            pageNumber={pageBase != null && pageTotal != null ? pageBase + 1 : undefined}
            pageTotal={pageTotal}
            hideBottomNav={hideBottomNav}
            audioKeyPrefix={examSetId ?? ""}
          />
        )}

        {partType === "part2" && part2Questions && (
          <ListeningPart2Match
            questions={part2Questions}
            currentIndex={safeIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            revealAnswers={isRevealedHere || isLockedHere}
            onAnswer={handleAnswer}
            {...navProps}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={() => toggleBookmark(currentIndex)}
            highlights={highlights}
            highlightLoading={effectiveHighlightLoading}
            hideTimer={hideTimer}
            pageNumber={pageBase != null && pageTotal != null ? pageBase + 1 : undefined}
            pageTotal={pageTotal}
            hideBottomNav={hideBottomNav}
            audioKeyPrefix={examSetId ?? ""}
          />
        )}

        {partType === "part3" && part3Questions && (
          <ListeningPart3Conversation
            questions={part3Questions}
            currentIndex={safeIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            revealAnswers={isRevealedHere || isLockedHere}
            onAnswer={handleAnswer}
            {...navProps}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={() => toggleBookmark(currentIndex)}
            highlights={highlights}
            highlightLoading={effectiveHighlightLoading}
            hideTimer={hideTimer}
            pageNumber={pageBase != null && pageTotal != null ? pageBase + 1 : undefined}
            pageTotal={pageTotal}
            hideBottomNav={hideBottomNav}
            audioKeyPrefix={examSetId ?? ""}
          />
        )}

        {partType === "part4" && part4Questions && (
          <ListeningPart4Monologue
            questions={part4Questions}
            currentIndex={safeIndex}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={timeLimit}
            submitted={submitted}
            revealAnswers={isRevealedHere || isLockedHere}
            onAnswer={handleAnswer}
            {...navProps}
            isBookmarked={bookmarked.has(currentIndex)}
            onToggleBookmark={() => toggleBookmark(currentIndex)}
            highlights={highlights}
            highlightLoading={effectiveHighlightLoading}
            hideTimer={hideTimer}
            pageNumber={pageBase != null && pageTotal != null ? pageBase + 1 : undefined}
            pageTotal={pageTotal}
            hideBottomNav={hideBottomNav}
            audioKeyPrefix={examSetId ?? ""}
          />
        )}

        {hideBottomNav && phase === "practice" && (
          <div className="flex items-center justify-between max-w-3xl mx-auto w-full mt-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-primary text-primary"
              onClick={arrowPrev}
              disabled={currentIndex === 0 && !onNavPrevSet}
            >
              ← Trước
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1}/{totalQuestions || 1}
            </span>
            <Button
              type="button"
              className="rounded-full bg-primary text-primary-foreground"
              onClick={arrowNext}
              disabled={currentIndex === totalQuestions - 1 && !onNavNextSet}
            >
              Sau →
            </Button>
          </div>
        )}
      </div>
    </div>
    </TimerProvider>
  );
};

export default ListeningExamEngine;
