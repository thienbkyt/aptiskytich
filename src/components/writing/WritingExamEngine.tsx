import { useState, useEffect, useCallback } from "react";
import { useExitWarning } from "@/hooks/useExitWarning";
import ExamHeader from "@/components/exam/ExamHeader";
import TimerDisplay from "@/components/reading/TimerDisplay";
import ExamInstructions from "@/components/exam/ExamInstructions";
import WritingPart1Short from "@/components/writing/WritingPart1Short";
import WritingPart2Social from "@/components/writing/WritingPart2Social";
import WritingPart3Questions from "@/components/writing/WritingPart3Questions";
import WritingPart4TwoEmails from "@/components/writing/WritingPart4TwoEmails";
import WritingResults from "@/components/writing/WritingResults";
import SpeakingFooter from "@/components/speaking/SpeakingFooter";
import BottomNavBar from "@/components/reading/BottomNavBar";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import RevealAnswerButton from "@/components/exam/RevealAnswerButton";
import { useExamGrading, type WritingGradingResult } from "@/hooks/useExamGrading";
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
  onComplete?: (perQuestion?: WritingPerQuestion[]) => void | Promise<string | null | void>;
  /** DB exam_sets.id this engine is rendering — forwarded to grading persistence. */
  examSetId?: string | null;
  onPrevious?: () => void;
  showResultsOnSubmit?: boolean;
  /** DB exam_questions.id list — used to persist the user's essay per part. */
  sourceQuestionIds?: string[];
  /** Open in read-only review mode (pre-submitted, intros skipped). */
  reviewMode?: boolean;
  /** When in reviewMode, the AI grading for this part to render below the editor. */
  gradingResult?: WritingGradingResult | null;
  /** Full-practice mode: when set, engine forwards answers and skips grading/results. */
  onPartAnswers?: (data: { partType: WritingPartType; text: string; questions: string[] }) => void;
  initialAnswers?: {
    shortAnswers?: string[];
    textAnswer?: string;
    part3Answers?: string[];
    informalAnswer?: string;
    formalAnswer?: string;
  };
  onAnswersChange?: (a: {
    shortAnswers: string[];
    textAnswer: string;
    part3Answers: string[];
    informalAnswer: string;
    formalAnswer: string;
  }) => void;
  /** When true, mount directly into practice phase (used when navigating back to a previous part). */
  enterAtLastQuestion?: boolean;
  /** Practice-only: show "Reveal answer" button (sample essay). Default false. Never set in Full Test. */
  allowReveal?: boolean;
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
  onExit, onComplete, onPrevious, sourceQuestionIds, examSetId,
  showResultsOnSubmit, onPartAnswers,
  reviewMode, gradingResult, initialAnswers, onAnswersChange, enterAtLastQuestion,
  allowReveal = false,
}: WritingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>((skipIntro || reviewMode || enterAtLastQuestion) ? "practice" : "instructions");
  const [hasStarted, setHasStarted] = useState<boolean>(skipIntro || !!reviewMode || !!enterAtLastQuestion);
  useEffect(() => { if (phase === "practice") setHasStarted(true); }, [phase]);
  const [internalTimeLeft, setInternalTimeLeft] = useState(externalTimeLeft ?? timeLimit);
  const timeLeft = externalTimeLeft ?? internalTimeLeft;
  const [submitted, setSubmitted] = useState(!!reviewMode);
  useExitWarning(hasStarted && !submitted && !reviewMode);
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
    initialAnswers?.shortAnswers ?? new Array(part1Data?.questions.length || 5).fill("")
  );
  const [textAnswer, setTextAnswer] = useState(initialAnswers?.textAnswer ?? "");
  const [part3Answers, setPart3Answers] = useState<string[]>(
    initialAnswers?.part3Answers ?? new Array(part3Data?.questions.length || 3).fill("")
  );
  const [informalAnswer, setInformalAnswer] = useState(initialAnswers?.informalAnswer ?? "");
  const [formalAnswer, setFormalAnswer] = useState(initialAnswers?.formalAnswer ?? "");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [partType]);

  const { grading, isGrading, gradeExam, quotaExceeded } = useExamGrading();
  const effectiveGrading = (gradingResult ?? grading) as WritingGradingResult | null;

  // Ensure exam-mode dark overrides apply during intro phase too
  // (intro screen renders no ExamHeader, so the body class wouldn't be set).
  useEffect(() => {
    if (reviewMode) return;
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, [reviewMode]);


  useEffect(() => {
    if (!hasStarted || submitted || timeLeft <= 0) return;
    const t = setInterval(() => {
      const next = Math.max(0, timeLeft - 1);
      if (onTimeTick) onTimeTick(next);
      if (externalTimeLeft === undefined) {
        setInternalTimeLeft((p) => Math.max(0, p - 1));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [hasStarted, submitted, timeLeft, externalTimeLeft, onTimeTick]);

  useEffect(() => {
    if (hasStarted && !submitted && timeLeft <= 0) handleSubmit();
  }, [hasStarted, submitted, timeLeft]);

  // Note: engine is remounted per part (key changes), so we no longer reset
  // answers on partType change — that would clobber restored initialAnswers.




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
          `SCENARIO (bối cảnh chung cho cả 2 email): ${part4Data.scenarioIntro}\n${part4Data.scenarioEmail}`,
          `Email 1 (Informal) instruction: ${part4Data.informalEmail.instruction}`,
          `Email 2 (Formal) instruction: ${part4Data.formalEmail.instruction}`,
        ],
      };
    }
    return { text: "", questions: [] };
  };

  // Forward live answers + submission map to parent (full-practice mode).
  useEffect(() => {
    if (reviewMode) return;
    onAnswersChange?.({ shortAnswers, textAnswer, part3Answers, informalAnswer, formalAnswer });
    if (onPartAnswers) {
      const { text, questions } = getTextAndQuestions();
      onPartAnswers({ partType, text, questions });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortAnswers, textAnswer, part3Answers, informalAnswer, formalAnswer, partType]);

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
    const perQuestion = buildPerQuestion();

    // Full-practice mode (parent collects answers and grades all parts together)
    if (onPartAnswers) {
      const { text, questions } = getTextAndQuestions();
      onPartAnswers({ partType, text, questions });
      onComplete?.(perQuestion);
      return;
    }

    setSubmitted(true);

    // Full-test mode (parent passes isLastPart): skip grading/results entirely
    if (isLastPart !== undefined && !showResultsOnSubmit) {
      onComplete?.(perQuestion);
      return;
    }

    setPhase("grading");

    // Resolve test_result_id from parent's save so grading can be linked to this attempt.
    const trid = (await Promise.resolve(onComplete?.(perQuestion))) as string | null | void;

    const { text, questions } = getTextAndQuestions();

    const result = await gradeExam({
      type: "writing",
      text,
      questions,
      partType,
      testResultId: (trid as string | null) ?? null,
      examSetId: examSetId ?? null,
      partLabel: PART_LABELS[partType],
    });

    // Bake AI grading into the saved review_snapshot so History review is self-sufficient.
    try {
      if (trid && result && (result as any).partScore !== undefined) {
        const w = result as WritingGradingResult;
        const { mergeSnapshotAI } = await import("@/lib/reviewItemsBuilder");
        const ai = {
          partScore: w.partScore,
          maxPoints: w.maxPoints,
          grammarErrors: w.grammarErrors || [],
          spellingErrors: w.spellingErrors || [],
          feedback: w.feedback || null,
        };
        // Writing snapshots are single-item per part (one merged "text" item).
        await mergeSnapshotAI(trid as string, { 0: ai }, {
          score: w.partScore,
          total: w.maxPoints,
          scaled50: w.maxPoints > 0 ? Math.round((w.partScore / w.maxPoints) * 50) : null,
        });
      }
    } catch (e) { console.warn("[Writing] bake AI failed", e); }

    setPhase("results");
  }, [onComplete, onPartAnswers, shortAnswers, textAnswer, part3Answers, informalAnswer, formalAnswer, partType, skipIntro, isLastPart, sourceQuestionIds]);

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
        {hasStarted && (
          <div className="pr-10 pb-3">
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
          </div>
        )}
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
        {hasStarted && (
          <div className="px-6 pt-3">
            <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
          </div>
        )}
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
          isInstructionsPhase
          onProceedFromInstructions={() => setPhase("practice")}
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
            grading={grading as import("@/hooks/useExamGrading").WritingGradingResult | null}
            onExit={onExit}
            submission={submission}
            onReview={!isGrading && grading ? () => setIsReviewing(true) : undefined}
            quotaExceeded={quotaExceeded}
          />
        </div>
      </div>
    );
  }

  const isLast = isLastPart ?? true;
  return (
    <div className={`bg-[#F3F3F3] flex flex-col ${reviewMode ? "" : "min-h-screen"}`}>

      {adminControls}
      {phase === "practice" && !submitted && !reviewMode && (
        <>
          <ExamReportButton
            examQuestionId={sourceQuestionIds?.[0] ?? null}
            examSetId={null}
            skill="writing"
            partType={partType}
            questionNumber={1}
          />
          {allowReveal && (
            <RevealAnswerButton revealed={revealed} onToggle={() => setRevealed(v => !v)} />
          )}
        </>
      )}
      <ExamHeader
        skillLabel="Writing"
        partLabel={partLabel}
        onExit={onExit}
        
        onBackToResults={isReviewing ? () => setIsReviewing(false) : undefined}
      />
      <div className={`flex-1 px-4 pt-8 ${reviewMode ? "pb-4" : "pb-20"} max-w-3xl mx-auto w-full`}>
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
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            onSubmitTest={!submitted ? handleSubmit : undefined}
            isLast={isLast}
            reviewMode={reviewMode}
            revealAnswers={revealed}
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
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            onSubmitTest={!submitted ? handleSubmit : undefined}
            isLast={isLast}
            reviewMode={reviewMode}
            revealAnswers={revealed}
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
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            onSubmitTest={!submitted ? handleSubmit : undefined}
            isLast={isLast}
            reviewMode={reviewMode}
            revealAnswers={revealed}
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
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            onSubmitTest={!submitted ? handleSubmit : undefined}
            isLast={isLast}
            reviewMode={reviewMode}
            revealAnswers={revealed}
          />
        )}

        {(reviewMode || isReviewing) && effectiveGrading && (() => {
          const allErrors = [
            ...(effectiveGrading.grammarErrors || []).map((e) => ({ ...e, kind: "Ngữ pháp" })),
            ...(effectiveGrading.spellingErrors || []).map((e) => ({ ...e, kind: "Chính tả" })),
          ];
          return (
            <div className="mt-4 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-heading font-bold text-foreground">Nhận xét của AI Kỳ Tích</h3>
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
                    {effectiveGrading.partScore}/{effectiveGrading.maxPoints}
                  </span>
                </div>
                {effectiveGrading.feedback && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{effectiveGrading.feedback}</p>
                )}
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-heading font-bold text-foreground mb-4">❌ Lỗi cần sửa</h3>
                {allErrors.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Không phát hiện lỗi ngữ pháp/chính tả.</p>
                ) : (
                  <div className="space-y-3">
                    {allErrors.map((m, i) => (
                      <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{m.kind}</p>
                        <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">&ldquo;{m.original}&rdquo;</p>
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ &ldquo;{m.corrected}&rdquo;</p>
                        <p className="text-xs text-muted-foreground">{m.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(effectiveGrading.improvedVersion || effectiveGrading.upgradeTips) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-3">
                  {effectiveGrading.improvedVersion && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 mb-1">✍️ AI Kỳ Tích sửa bài</p>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{effectiveGrading.improvedVersion}</p>
                    </div>
                  )}
                  {effectiveGrading.upgradeTips && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary mb-1">🎯 Mẹo đạt điểm cao Aptis</p>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{effectiveGrading.upgradeTips}</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default WritingExamEngine;
