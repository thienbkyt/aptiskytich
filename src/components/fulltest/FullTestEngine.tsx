import { useState, useEffect, useCallback, useRef } from "react";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, Loader2, CheckCircle2, Mic, Headphones, Brain, BookOpen, PenLine, Trophy } from "lucide-react";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, type ExamQuestionRow } from "@/hooks/useExamSets";
import {
  toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4,
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
  toGrammarQuestions,
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
  toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4,
} from "@/lib/examTransformers";
import { saveExamResult, saveSpeakingRecording } from "@/lib/saveExamResult";
import { getLevel, getLevelColor } from "@/data/questions";
import { useAuth } from "@/hooks/useAuth";

import SpeakingExamEngine, { type SpeakingPartSubmission } from "@/components/speaking/SpeakingExamEngine";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import AdminExamControls from "@/components/exam/AdminExamControls";
import { normalizePart, readingPartLabel } from "@/hooks/useExamSets";
import { gradeSpeakingItems, saveSpeakingGradings } from "@/components/speaking/speakingGrading";
import {
  gradeSpeakingPartV2,
  finalizeSpeaking,
  saveSpeakingSkillResult,
  type SpeakingPartResultV2,
} from "@/components/speaking/speakingGradingV2";
import { gradeWritingPartV2, finalizeWriting, saveWritingSkillResult } from "@/components/writing/writingGradingV2";
import { useExamGrading, type WritingGradingResult } from "@/hooks/useExamGrading";
import FullTestScoreTable from "@/components/fulltest/FullTestScoreTable";
import { toast } from "sonner";
import { safeRandomId } from "@/lib/browserCompat";
import { safeText } from "@/lib/safeText";

type SkillStep = "speaking" | "listening" | "grammar" | "reading" | "writing";
const SKILL_ORDER: SkillStep[] = ["speaking", "listening", "grammar", "reading", "writing"];
const SKILL_LABELS: Record<SkillStep, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};
const SKILL_ICONS: Record<SkillStep, React.ElementType> = {
  speaking: Mic,
  listening: Headphones,
  grammar: Brain,
  reading: BookOpen,
  writing: PenLine,
};
const SKILL_TIMES: Record<SkillStep, number> = {
  speaking: 720,
  listening: 2400,
  grammar: 1500,
  reading: 2100,
  writing: 3000,
};

interface FullTestEngineProps {
  testId: string;
  testTitle: string;
  onExit: () => void;
}

interface PartSet {
  id: string;
  part: string;
  partNorm: string;
  questions: ExamQuestionRow[];
}

type SkillData = Record<SkillStep, PartSet[]>;

type FlowPhase = "loading" | "skill-intro" | "exam" | "skill-transition" | "finalizing-writing" | "completed";

const FullTestEngine = ({ testId, testTitle, onExit }: FullTestEngineProps) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [skillData, setSkillData] = useState<SkillData>({
    speaking: [], listening: [], grammar: [], reading: [], writing: [],
  });
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [scores, setScores] = useState<Record<SkillStep, { correct: number; total: number }>>({
    speaking: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
  });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Key to force re-mount engines on part change
  const [engineKey, setEngineKey] = useState(0);
  const [writingTimeLeft, setWritingTimeLeft] = useState(SKILL_TIMES.writing);
  const [listeningTimeLeft, setListeningTimeLeft] = useState(SKILL_TIMES.listening);
  // Prevent double-advancing if a child engine fires onComplete twice
  // (e.g. timer + finish-button race). Keyed by `${skill}-${partIndex}`.
  const completedKeysRef = useRef<Set<string>>(new Set());
  const adminNavigationRef = useRef(false);
  const { isAdmin } = useAuth();
  // Unique id for this Full Test attempt — groups all 5 skills' rows in /history.
  const sessionIdRef = useRef<string>(
    safeRandomId("full_test_session")
  );

  // Background grading state for Speaking in Full Test
  const speakingDataByPartRef = useRef<Record<number, { sub: SpeakingPartSubmission; partId: string | null; partLabel: string }>>({});
  const [speakingGradingPending, setSpeakingGradingPending] = useState(false);
  const speakingGradingStartedRef = useRef(false);
  const speakingGradingPromiseRef = useRef<Promise<void> | null>(null);

  // Writing grading state for Full Test (graded at the very end after writing's last part)
  const writingSubmissionsByPartRef = useRef<Record<number, { partType: string; text: string; questions: string[]; partId: string | null; partLabel: string; perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }> }>>({});
  const writingRawAnswersByPartRef = useRef<Record<number, {
    shortAnswers: string[]; textAnswer: string; part3Answers: string[]; informalAnswer: string; formalAnswer: string;
  }>>({});
  const [writingGradedCount, setWritingGradedCount] = useState(0);
  const [writingTotalToGrade, setWritingTotalToGrade] = useState(0);
  const [waitingForSpeaking, setWaitingForSpeaking] = useState(false);
  useExitWarning(phase !== "loading" && phase !== "completed" && phase !== "finalizing-writing");
  const { gradeExam } = useExamGrading();



  const currentSkill = SKILL_ORDER[currentSkillIndex];

  // Load ALL skill data upfront
  useEffect(() => {
    loadAllData();
  }, [testId]);

  const loadAllData = async () => {
    setPhase("loading");

    // Full Test → resolve member exam_set_ids via full_test_members join table.
    const { data: members } = await supabase
      .from("full_test_members")
      .select("exam_set_id")
      .eq("full_test_id", testId);

    const memberIds = (members || []).map((m) => m.exam_set_id);
    const { data: sets } = memberIds.length
      ? await supabase
          .from("exam_sets")
          .select("id, part, skill, created_at")
          .in("id", memberIds)
          .eq("is_published", true)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

    if (!sets || sets.length === 0) {
      setPhase("completed");
      return;
    }

    // Load all questions for all sets in parallel
    const setsWithQuestions = await Promise.all(
      sets.map(async (s) => {
        const questions = await fetchExamQuestions(s.id);
        return { ...s, questions, partNorm: normalizePart(s.part) };
      })
    );

    // Group by skill
    const grouped: SkillData = {
      speaking: [], listening: [], grammar: [], reading: [], writing: [],
    };

    for (const s of setsWithQuestions) {
      const skillKey = s.skill === "grammar_vocab" ? "grammar" : s.skill as SkillStep;
      if (grouped[skillKey]) {
        grouped[skillKey].push({
          id: s.id,
          part: s.part,
          partNorm: s.partNorm,
          questions: s.questions,
        });
      }
    }

    // Sort parts within each skill by part name to ensure correct order
    for (const skill of SKILL_ORDER) {
      grouped[skill].sort((a, b) => a.part.localeCompare(b.part));
    }

    setSkillData(grouped);
    setPhase("exam");
  };

  const handlePartComplete = useCallback((
    correct?: number,
    total?: number,
    perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }>
  ) => {
    if (adminNavigationRef.current) return;
    const skill = SKILL_ORDER[currentSkillIndex];
    const parts = skillData[skill];

    // Idempotency guard: ignore duplicate onComplete calls for the same part
    const key = `${skill}-${currentPartIndex}`;
    if (completedKeysRef.current.has(key)) return;
    completedKeysRef.current.add(key);

    // Accumulate scores
    if (correct !== undefined && total !== undefined) {

      setScores(prev => ({
        ...prev,
        [skill]: {
          correct: prev[skill].correct + correct,
          total: prev[skill].total + total,
        },
      }));
      // Persist per-set result so it appears in /history
      const setIdForGrammar = parts[0]?.id ?? null;
      const examSetId = skill === "grammar" ? setIdForGrammar : (parts[currentPartIndex]?.id ?? null);
      (async () => {
        const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
        const {
          buildGrammarItems, buildReadingItems, buildListeningItems, computeScaleAndBand,
        } = await import("@/lib/reviewItemsBuilder");
        const partNorm = parts[currentPartIndex]?.partNorm ?? null;
        const partQuestions = parts[currentPartIndex]?.questions ?? [];
        let items: any[] = [];
        try {
          if (skill === "grammar") {
            items = buildGrammarItems(partQuestions, perQuestion || []);
          } else if (skill === "reading" && partNorm) {
            const { toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4 } = await import("@/lib/examTransformers");
            const ed: any = {};
            if (partNorm === "part1") ed.part1Question = toReadingPart1(partQuestions);
            else if (partNorm === "part2") ed.part2Question = toReadingPart2(partQuestions);
            else if (partNorm === "part3") ed.part3Question = toReadingPart3(partQuestions);
            else if (partNorm === "part4") ed.part4Question = toReadingPart4(partQuestions);
            items = buildReadingItems(partNorm as any, ed, {}, {}, perQuestion || []);
          } else if (skill === "listening" && partNorm) {
            const { toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4 } = await import("@/lib/examTransformers");
            const ed: any = {};
            if (partNorm === "part1") ed.part1Questions = toListeningPart1(partQuestions);
            else if (partNorm === "part2") ed.part2Questions = toListeningPart2(partQuestions);
            else if (partNorm === "part3") ed.part3Questions = toListeningPart3(partQuestions);
            else if (partNorm === "part4") ed.part4Questions = toListeningPart4(partQuestions);
            items = buildListeningItems(partNorm as any, ed, {}, perQuestion || []);
          }
        } catch { /* noop */ }
        const { scaled50, band } = computeScaleAndBand(skill, correct, total);
        const snap = buildReviewSnapshot({
          skill: skill === "grammar" ? "grammar_vocab" : skill,
          part: partNorm,
          testTitle: null,
          score: correct, total, scaled50, band,
          items,
          raw: {
            skill, partType: partNorm,
            questions: partQuestions,
            perQuestion: perQuestion || [],
          },
        });
        saveExamResult({
          examSetId,
          skill: skill === "grammar" ? "grammar_vocab" : skill,
          correct, total,
          perQuestion,
          fullTestSessionId: sessionIdRef.current,
          fullTestId: testId,
          reviewSnapshot: snap,
        });
      })();
    }

    // Check if there are more parts in this skill
    // For grammar, all parts are combined into one engine call, so always move to next skill
    if (skill === "grammar" || currentPartIndex >= parts.length - 1) {
      // Skill completed - auto advance to next skill or finish
      if (currentSkillIndex >= SKILL_ORDER.length - 1) {
        setPhase("completed");
      } else {
        setCurrentSkillIndex(prev => prev + 1);
        setCurrentPartIndex(0);
        setEngineKey(prev => prev + 1);
        setPhase("exam");
      }
    } else {
      // Move to next part within same skill
      setCurrentPartIndex(prev => prev + 1);
      // Writing & Listening keep the same engine mounted to preserve timer + skip intros
      if (skill !== "writing" && skill !== "listening") {
        setEngineKey(prev => prev + 1);
      }
    }
  }, [currentSkillIndex, currentPartIndex, skillData]);

  const handleNextSkill = () => {
    setCurrentSkillIndex(prev => prev + 1);
    setCurrentPartIndex(0);
    setEngineKey(prev => prev + 1);
    setPhase("exam");
  };

  const handleStartSkill = () => {
    setPhase("exam");
  };

  // ── Progress bar ──
  const progressBar = (
    <div className="flex items-center gap-2 mb-4">
      {SKILL_ORDER.map((skill, i) => (
        <div key={skill} className="flex items-center gap-1">
          <div
            className={`h-1.5 rounded-full transition-all ${
              i < currentSkillIndex ? "bg-green-500 w-10"
                : i === currentSkillIndex ? "bg-primary w-14"
                : "bg-muted w-10"
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-2">
        {currentSkillIndex + 1}/{SKILL_ORDER.length} – {SKILL_LABELS[currentSkill]}
      </span>
    </div>
  );

  // Inner engines (ExamHeader / SpeakingHeader) already show the confirm popup.
  // On confirm they call onExit → just exit the full test.
  const handleExit = () => onExit();

  // ===== Admin-only cross-skill navigation (part-level) =====
  // Find next/previous non-empty skill index relative to a starting index.
  const findSkillIndex = (from: number, dir: 1 | -1): number => {
    let i = from + dir;
    while (i >= 0 && i < SKILL_ORDER.length) {
      if (skillData[SKILL_ORDER[i]].length > 0) return i;
      i += dir;
    }
    return -1;
  };

  const goToPart = (skillIdx: number, partIdx: number) => {
    adminNavigationRef.current = true;
    window.setTimeout(() => { adminNavigationRef.current = false; }, 800);
    // Clear idempotency keys for the target part so onComplete can re-fire.
    const sk = SKILL_ORDER[skillIdx];
    completedKeysRef.current.delete(`${sk}-${partIdx}`);
    setCurrentSkillIndex(skillIdx);
    setCurrentPartIndex(partIdx);
    setEngineKey((k) => k + 1);
    setPhase("exam");
    // Reset shared timers when switching into a skill that uses one
    if (sk === "listening") setListeningTimeLeft(SKILL_TIMES.listening);
    if (sk === "writing") setWritingTimeLeft(SKILL_TIMES.writing);
  };

  const handleAdminBackPart = () => {
    if (currentPartIndex > 0) {
      goToPart(currentSkillIndex, currentPartIndex - 1);
      return;
    }
    if (!isAdmin) return;
    const prevSkill = findSkillIndex(currentSkillIndex, -1);
    if (prevSkill === -1) return;
    const prevSkillKey = SKILL_ORDER[prevSkill];
    const prevParts = skillData[prevSkillKey];
    // Grammar = single engine call → go to "part 0"
    const targetPart =
      prevSkillKey === "grammar" ? 0 : Math.max(0, prevParts.length - 1);
    goToPart(prevSkill, targetPart);
  };

  const canGoBackPart =
    currentPartIndex > 0 || (isAdmin && findSkillIndex(currentSkillIndex, -1) !== -1);

  const handleParentAdminSkip = () => {
    if (phase === "skill-intro") {
      if (skillData[currentSkill].length > 0) setPhase("exam");
      else if (currentSkillIndex >= SKILL_ORDER.length - 1) setPhase("completed");
      else handleNextSkill();
    } else if (phase === "skill-transition") {
      if (currentSkillIndex >= SKILL_ORDER.length - 1) setPhase("completed");
      else handleNextSkill();
    }
  };

  const adminOverlay = phase !== "exam" && phase !== "loading" && phase !== "completed" ? (
    <AdminExamControls
      label={`${SKILL_LABELS[currentSkill]} · Chuyển kỹ năng`}
      onSkip={handleParentAdminSkip}
      onBack={canGoBackPart ? handleAdminBackPart : undefined}
    />
  ) : null;

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu bài thi...</p>
      </div>
    );
  }

  // ── Finalizing Writing (grade all parts + wait for speaking) ──
  if (phase === "finalizing-writing") {
    const total = writingTotalToGrade || 0;
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <h2 className="text-xl font-heading font-bold text-foreground">
          AI Kỳ Tích đang chấm Writing và tổng hợp kết quả...
        </h2>
        {waitingForSpeaking && (
          <p className="text-sm text-muted-foreground">Đang chờ phần Speaking chấm xong...</p>
        )}
        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            Đã chấm {writingGradedCount}/{total} phần Writing
          </p>
        )}
        <p className="text-xs text-muted-foreground max-w-md">
          Vui lòng không tắt trình duyệt. Quá trình này có thể mất vài chục giây.
        </p>
      </div>
    );
  }

  // ── Completed ──
  if (phase === "completed") {
    return (
      <div className="min-h-[70vh] pb-16">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>

        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Hoàn thành bài thi thử!</h2>
          <p className="text-muted-foreground">{testTitle}</p>
          {speakingGradingPending && (
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> AI Kỳ Tích đang chấm Speaking...
            </p>
          )}
        </div>

        {/* Aptis score table */}
        <div className="max-w-3xl mx-auto">
          <FullTestScoreTable scores={scores} />
        </div>


        <div className="text-center mt-8 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => navigate(`/history/full-test/${sessionIdRef.current}`)}
            variant="outline"
            className="gap-2"
          >
            <Eye className="w-4 h-4" /> Xem lại từng câu
          </Button>
          <Button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Quay lại danh sách đề
          </Button>
        </div>
      </div>
    );
  }

  const partsForSkill = skillData[currentSkill];

  // ── Skill Intro Screen ──
  if (phase === "skill-intro") {
    const Icon = SKILL_ICONS[currentSkill];
    const partCount = partsForSkill.length;
    const totalMinutes = Math.ceil(SKILL_TIMES[currentSkill] / 60);

    // Skip if no data for this skill
    if (partCount === 0) {
      return (
        <div className="min-h-[70vh]">
          {progressBar}
        {adminOverlay}
          <div className="max-w-xl mx-auto text-center py-12">
            <p className="text-muted-foreground mb-4">
              Chưa có dữ liệu cho phần {SKILL_LABELS[currentSkill]}.
            </p>
            <Button onClick={() => {
              if (currentSkillIndex >= SKILL_ORDER.length - 1) {
                setPhase("completed");
              } else {
                handleNextSkill();
              }
            }} className="bg-primary hover:bg-brand-brown text-white">
              Bỏ qua, tiếp tục
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[70vh]">
        {progressBar}
        {adminOverlay}
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            {SKILL_LABELS[currentSkill]}
          </h2>
          <p className="text-muted-foreground mb-1">
            {currentSkill === "grammar"
              ? `${partCount} phần • ${totalMinutes} phút`
              : `${partCount} Part • ${totalMinutes} phút`}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            {currentSkill === "grammar"
              ? "Hoàn thành tất cả các câu hỏi Grammar & Vocabulary."
              : `Hoàn thành lần lượt từ Part 1 đến Part ${partCount}.`}
          </p>
          <Button onClick={handleStartSkill} className="bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5 px-8">
            Bắt đầu phần {SKILL_LABELS[currentSkill]}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Skill Transition Screen ──
  if (phase === "skill-transition") {
    const completedSkill = SKILL_ORDER[currentSkillIndex];
    const nextSkill = SKILL_ORDER[currentSkillIndex + 1];
    const NextIcon = nextSkill ? SKILL_ICONS[nextSkill] : CheckCircle2;

    return (
      <div className="min-h-[70vh]">
        {progressBar}
        {adminOverlay}
        <div className="max-w-lg mx-auto text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Bạn đã hoàn thành phần {SKILL_LABELS[completedSkill]}!
          </h2>
          {nextSkill && (
            <>
              <p className="text-muted-foreground mb-8">
                Bấm để chuyển sang phần <strong>{SKILL_LABELS[nextSkill]}</strong>.
              </p>
              <Button onClick={handleNextSkill} className="bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5 px-8">
                <NextIcon className="w-4 h-4" />
                Chuyển sang {SKILL_LABELS[nextSkill]}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Exam Phase ──
  if (partsForSkill.length === 0) return null;

  // For grammar: merge ALL parts into a single question list
  if (currentSkill === "grammar") {
    const allQuestions = partsForSkill.flatMap(p => p.questions);
    const grammarQuestions = toGrammarQuestions(allQuestions);
    return (
      <>
        {progressBar}
        {adminOverlay}
        <GrammarExamEngine
          key={`grammar-${engineKey}`}
          questions={grammarQuestions}
          testTitle={`${testTitle} – Grammar & Vocabulary`}
          timeLimit={SKILL_TIMES.grammar}
          onExit={handleExit}
          onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
          onPreviousPart={canGoBackPart ? handleAdminBackPart : undefined}
          skipIntro={currentPartIndex > 0}
        />
      </>
    );
  }

  // For other skills: render current part
  const currentPart = partsForSkill[currentPartIndex];
  if (!currentPart) return null;

  const partNorm = currentPart.partNorm;

  if (currentSkill === "speaking") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const speakingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": speakingProps.part1Data = toSpeakingPart1(currentPart.questions); break;
      case "part2": speakingProps.part2Data = toSpeakingPart2(currentPart.questions); break;
      case "part3": speakingProps.part3Data = toSpeakingPart3(currentPart.questions); break;
      case "part4": speakingProps.part4Data = toSpeakingPart4(currentPart.questions); break;
    }
    const isLastSpeakingPart = currentPartIndex >= partsForSkill.length - 1;

    const handleSpeakingPartSubs = (sub: SpeakingPartSubmission) => {
      speakingDataByPartRef.current[currentPartIndex] = {
        sub,
        partId: currentPart.id ?? null,
        partLabel: currentPart.part,
      };
    };

    const runSpeakingGradingBackground = async () => {
      if (speakingGradingStartedRef.current) return;
      speakingGradingStartedRef.current = true;
      setSpeakingGradingPending(true);
      try {
        const orderedIndices = Object.keys(speakingDataByPartRef.current)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b);
        const orderedEntries = orderedIndices
          .map((i) => speakingDataByPartRef.current[i])
          .filter(Boolean);

        let totalMax = 0;
        for (const e of orderedEntries) {
          totalMax += e.sub.items.reduce((s, it) => s + (it.spec.maxPoints || 0), 0);
        }
        const maxRounded = Math.max(Math.round(totalMax), 1);

        const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
        const { buildSpeakingItems, computeScaleAndBand, mergeSnapshotAI } = await import("@/lib/reviewItemsBuilder");

        // 1) Create the test_results row FIRST with a placeholder score so recordings
        //    can be linked even if grading fails later.
        const speakingItemSpecsInitial: any[] = [];
        orderedEntries.forEach((e) => {
          e.sub.items.forEach((it, itIdx) => {
            speakingItemSpecsInitial.push({
              questionText: it.spec.questionText || `Part ${e.sub.partNumber} · Q${itIdx + 1}`,
              recordingPath: null,
              ai: null,
            });
          });
        });
        const initialSnap = buildReviewSnapshot({
          skill: "speaking",
          part: null,
          testTitle: "Full Test · Speaking",
          score: 0, total: maxRounded,
          scaled50: null, band: null,
          items: buildSpeakingItems(speakingItemSpecsInitial),
          raw: {
            perPart: orderedEntries.map((e) => ({
              partType: e.sub.partType,
              partId: e.partId,
              itemCount: e.sub.items.length,
              gradings: [],
            })),
          },
        });
        const testResultId = await saveExamResult({
          examSetId: orderedEntries[0]?.partId ?? null,
          skill: "speaking",
          correct: 0,
          total: maxRounded,
          fullTestSessionId: sessionIdRef.current,
          fullTestId: testId,
          reviewSnapshot: initialSnap,
        });

        // 2) Upload recordings immediately, independent of grading.
        const pathByIndex: Record<number, string> = {};
        try {
          let cursor = 0;
          for (const entry of orderedEntries) {
            const partNorm = entry.sub.partType;
            const baseIdx = cursor;
            await Promise.all(entry.sub.items.map(async (item, idx) => {
              if (!item.blob) return;
              try {
                const path = await saveSpeakingRecording({
                  examSetId: entry.partId,
                  part: `${partNorm}_q${idx + 1}`,
                  blob: item.blob,
                  durationSeconds: item.actualSpoken,
                  testResultId,
                });
                if (path) pathByIndex[baseIdx + idx] = path;
              } catch (e) {
                console.warn("[FullTestEngine] saveSpeakingRecording failed", e);
              }
            }));
            cursor += entry.sub.items.length;
          }
        } catch (e) {
          console.warn("[FullTestEngine] speaking recordings upload failed", e);
        }

        // 3) V2 grading per part — silent (no toast spam).
        const v2ByPart: Record<string, SpeakingPartResultV2> = {};
        const v2EntriesPayload: Record<string, any> = {};
        try {
          for (const entry of orderedEntries) {
            const partType = entry.sub.partType as "part1" | "part2" | "part3" | "part4";
            const questions = entry.sub.items.map((it) => safeText(it.spec.questionText));
            const blobs = entry.sub.items.map((it) => it.blob ?? null);
            try {
              const r = await gradeSpeakingPartV2(partType, questions.map((q) => ({ questionText: q })), blobs, {
                sessionId: sessionIdRef.current,
                fullTestSessionId: sessionIdRef.current,
              });

              const merged: SpeakingPartResultV2 = {
                ...r,
                perItem: (r.perItem || []).map((it, i) => ({
                  ...it,
                  questionText: safeText(it.questionText) || questions[i] || `Question ${i + 1}`,
                  transcript: safeText((it as any).transcript),
                  improvedVersion: safeText((it as any).improvedVersion),
                  upgradeTips: safeText((it as any).upgradeTips),
                })),
              };

              v2ByPart[partType] = merged;
              v2EntriesPayload[partType] = {
                bands: merged.bands,
                items: merged.perItem,
                analysis: merged.analysis,
                criteriaAnalysis: merged.criteriaAnalysis,
                feedback: merged.feedback,
                improvedVersion: merged.improvedVersion,
                rawPart: merged.rawPart,
              };
            } catch (e) {
              console.warn(`[FullTestEngine V2] gradeSpeakingPartV2 ${partType} failed`, e);
            }
          }
        } catch (e) {
          console.warn("[FullTestEngine V2] speaking V2 grading failed", e);
        }

        // 4) Finalize → /50 + CEFR + flags.
        const rawParts = {
          part1: v2ByPart.part1?.rawPart ?? 0,
          part2: v2ByPart.part2?.rawPart ?? 0,
          part3: v2ByPart.part3?.rawPart ?? 0,
          part4: v2ByPart.part4?.rawPart ?? 0,
        };
        let scale50 = 0, cefr = "", greyZone = false, flagReview = false, rawTotal = 0;
        try {
          const f = await finalizeSpeaking(rawParts, null);
          scale50 = f.scale50; cefr = f.cefr; greyZone = f.greyZone;
          flagReview = f.flagReview; rawTotal = f.rawTotal;
        } catch (e) {
          console.warn("[FullTestEngine V2] finalizeSpeaking failed", e);
        }

        // 5) Save ONE speaking_skill_results row (all 4 parts + scale50 + cefr).
        try {
          await saveSpeakingSkillResult({
            testResultId,
            examSetId: orderedEntries[0]?.partId ?? null,
            fullTestSessionId: sessionIdRef.current,
            parts: v2EntriesPayload,
            rawTotal,
            scale50,
            cefr,
            greyZone,
            flagReview,
          });
        } catch (e) {
          console.warn("[FullTestEngine V2] saveSpeakingSkillResult failed", e);
        }

        // 6) Update review snapshot with scale50/band + put speaking score (/50) into full test scores.
        try {
          if (testResultId) {
            await mergeSnapshotAI(testResultId, {}, {
              score: scale50,
              total: 50,
              scaled50: scale50,
              band: cefr || null,
            });
          }
        } catch (e) {
          console.warn("[FullTestEngine V2] mergeSnapshotAI failed", e);
        }

        setScores((prev) => ({
          ...prev,
          speaking: { correct: scale50, total: 50 },
        }));
      } catch (e) {
        console.warn("[FullTestEngine] speaking grading failed", e);
      } finally {
        setSpeakingGradingPending(false);
      }
    };


    const handleSpeakingComplete = () => {
      const wasLast = isLastSpeakingPart;
      handlePartComplete();
      if (wasLast) {
        // Fire-and-forget: student continues to listening immediately.
        // Track the promise so writing's final grading can await it.
        speakingGradingPromiseRef.current = runSpeakingGradingBackground();
      }
    };

    return (
      <>
        {progressBar}
        {adminOverlay}
        <SpeakingExamEngine
          key={`speaking-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Speaking ${currentPart.part}`}
          timeLimit={SKILL_TIMES.speaking}
          examSetId={currentPart.id}
          fullTestSessionId={sessionIdRef.current}
          fullTestId={testId}
          onExit={handleExit}
          fullFlow
          isLastPart={isLastSpeakingPart}
          onPartSubmissions={handleSpeakingPartSubs}
          onComplete={handleSpeakingComplete}
          skipIntro={currentPartIndex > 0}
          onAdminPrevious={canGoBackPart ? handleAdminBackPart : undefined}
          {...speakingProps}
        />
      </>
    );
  }

  if (currentSkill === "listening") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const listeningProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": listeningProps.part1Questions = toListeningPart1(currentPart.questions); break;
      case "part2": listeningProps.part2Questions = toListeningPart2(currentPart.questions); break;
      case "part3": listeningProps.part3Questions = toListeningPart3(currentPart.questions); break;
      case "part4": listeningProps.part4Questions = toListeningPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        {adminOverlay}
        <ListeningExamEngine
          key="listening-full"
          partType={partType}
          testTitle={`${testTitle} – Listening ${currentPart.part}`}
          timeLimit={SKILL_TIMES.listening}
          onExit={handleExit}
          externalTimeLeft={listeningTimeLeft}
          onTimeTick={setListeningTimeLeft}
          skipIntro={currentPartIndex > 0}
          fullFlow
          onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
          onPreviousPart={canGoBackPart ? handleAdminBackPart : undefined}
          {...listeningProps}
        />
      </>
    );
  }

  if (currentSkill === "reading") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const readingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": readingProps.part1Question = toReadingPart1(currentPart.questions); break;
      case "part2": readingProps.part2Question = toReadingPart2(currentPart.questions); break;
      case "part3": readingProps.part3Question = toReadingPart3(currentPart.questions); break;
      case "part4": readingProps.part4Question = toReadingPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        {adminOverlay}
        <ReadingExamEngine
          key={`reading-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Reading ${readingPartLabel(currentPart.part)}`}
          timeLimit={SKILL_TIMES.reading}
          skipIntro={currentPartIndex > 0}
          fullFlow
          onExit={handleExit}
          onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
          onPreviousPart={canGoBackPart ? handleAdminBackPart : undefined}
          {...readingProps}
        />
      </>
    );
  }

  if (currentSkill === "writing") {
    // Map normalized "partN" → WritingExamEngine's "taskN" partType
    const partMap: Record<string, "task1" | "task2" | "task3" | "task4"> = {
      part1: "task1", part2: "task2", part3: "task3", part4: "task4",
    };
    const partType = partMap[partNorm];
    if (!partType) return null;
    const writingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "task1": writingProps.part1Data = toWritingPart1(currentPart.questions); break;
      case "task2": writingProps.part2Data = toWritingPart2(currentPart.questions); break;
      case "task3": writingProps.part3Data = toWritingPart3(currentPart.questions); break;
      case "task4": writingProps.part4Data = toWritingPart4(currentPart.questions); break;
    }
    const isLastWritingPart = currentPartIndex >= partsForSkill.length - 1;

    const handleWritingPartAnswers = (data: { partType: string; text: string; questions: string[] }) => {
      writingSubmissionsByPartRef.current[currentPartIndex] = {
        ...data,
        partId: currentPart.id ?? null,
        partLabel: currentPart.part,
      };
    };

    const runWritingFinalize = async () => {
      // Wait for speaking grading to finish so its score is included in the summary.
      if (speakingGradingPromiseRef.current) {
        setWaitingForSpeaking(true);
        try { await speakingGradingPromiseRef.current; } catch {}
        setWaitingForSpeaking(false);
      }

      const orderedIndices = Object.keys(writingSubmissionsByPartRef.current)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);
      const orderedEntries = orderedIndices
        .map((i) => writingSubmissionsByPartRef.current[i])
        .filter(Boolean);

      setWritingTotalToGrade(orderedEntries.length);
      setWritingGradedCount(0);

      // Grade each part sequentially with v2 analytic rubric. One test_results row
      // per part carries that part's AI raw score; the LAST row is patched to
      // scale50/50/CEFR after finalize so summary + history reflect the rubric.
      const { data: { user } } = await supabase.auth.getUser();
      const rawParts: { task1?: number; task2?: number; task3?: number; task4?: number } = {};
      const partsPayload: Record<string, any> = {};
      let anyForcedComplexity = false;
      let failedParts = 0;
      let lastTestResultId: string | null = null;
      let lastExamSetId: string | null = null;

      for (let i = 0; i < orderedEntries.length; i++) {
        const e = orderedEntries[i];
        const origIdx = orderedIndices[i];
        const raw = writingRawAnswersByPartRef.current[origIdx] || {
          shortAnswers: [], textAnswer: "", part3Answers: [], informalAnswer: "", formalAnswer: "",
        };
        const partsInput: any = {};
        if (e.partType === "task1") partsInput.shortAnswers = raw.shortAnswers;
        else if (e.partType === "task3") partsInput.threeAnswers = raw.part3Answers;
        else if (e.partType === "task4") {
          partsInput.informalText = raw.informalAnswer;
          partsInput.formalText = raw.formalAnswer;
        }

        // Pre-create a placeholder test_results row so the safety-net queue can
        // link a failed grade back to this attempt (worker writes the score to it).
        let preTestResultId: string | null = null;
        try {
          const { buildReviewSnapshot: buildSnap } = await import("@/lib/reviewSnapshot");
          const placeholderSnap = buildSnap({
            skill: "writing",
            part: e.partType,
            testTitle: e.partLabel ?? null,
            score: 0, total: 30, scaled50: 0, band: "",
            items: [{
              questionText: (e.questions || []).join("\n\n") || (e.partLabel ?? e.partType),
              userAnswer: e.text || (e.perQuestion?.[0]?.user_answer ?? ""),
              isCorrect: false,
              ai: null,
            }],
            raw: { partType: e.partType, text: e.text, questions: e.questions, ai: null, notGraded: true },
          });
          preTestResultId = await saveExamResult({
            examSetId: e.partId ?? null,
            skill: "writing",
            correct: 0,
            total: 30,
            perQuestion: e.perQuestion,
            fullTestSessionId: sessionIdRef.current,
            fullTestId: testId,
            reviewSnapshot: placeholderSnap,
          });
        } catch (err) {
          console.warn("[FullTest v2] pre-create test_results failed", err);
        }

        let v2: Awaited<ReturnType<typeof gradeWritingPartV2>> | null = null;
        try {
          v2 = await gradeWritingPartV2(e.partType as any, e.questions, e.text, partsInput, {
            testResultId: preTestResultId,
            examSetId: e.partId ?? null,
            fullTestSessionId: sessionIdRef.current,
          });
        } catch (err) {
          console.warn(`[FullTest v2] gradeWritingPartV2 ${e.partType} failed`, err);
        }
        if (!v2) {
          failedParts += 1;
          setWritingGradedCount(i + 1);
          continue;
        }
        rawParts[e.partType as keyof typeof rawParts] = v2.rawPart;
        if (v2.forcedComplexity) anyForcedComplexity = true;
        partsPayload[e.partType] = {
          bands: v2.bands, rawPart: v2.rawPart, perItem: v2.perItem,
          analysis: v2.analysis, criteriaAnalysis: v2.criteriaAnalysis,
          feedback: v2.feedback, improvedVersion: v2.improvedVersion,
          grammarErrors: v2.grammarErrors, spellingErrors: v2.spellingErrors,
        };

        const partScoreRounded = Math.round(v2.rawPart);
        const partMaxRounded = 30;

        const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
        const userText = e.text || (e.perQuestion?.[0]?.user_answer ?? "");
        const promptText = (e.questions || []).join("\n\n") || (e.partLabel ?? e.partType);
        const scaled50 = Math.round((v2.rawPart / 30) * 50);
        const writingSnap = buildReviewSnapshot({
          skill: "writing",
          part: e.partType,
          testTitle: e.partLabel ?? null,
          score: partScoreRounded, total: partMaxRounded,
          scaled50, band: "",
          items: [{
            questionText: promptText,
            userAnswer: userText,
            isCorrect: false,
            ai: {
              partScore: v2.rawPart,
              maxPoints: 30,
              grammarErrors: v2.grammarErrors,
              spellingErrors: v2.spellingErrors,
              feedback: v2.feedback,
            },
          }],
          raw: { partType: e.partType, text: e.text, questions: e.questions, ai: v2 },
        });
        // Update the pre-created placeholder with the real graded snapshot,
        // instead of creating a second test_results row.
        let testResultId: string | null = preTestResultId;
        if (preTestResultId) {
          try {
            await supabase.from("test_results").update({
              score: partScoreRounded,
              total: partMaxRounded,
              correct_answers: partScoreRounded,
              review_snapshot: writingSnap as any,
            } as any).eq("id", preTestResultId);
          } catch (err) { console.warn("[FullTest v2] update pre-test_results failed", err); }
        } else {
          testResultId = await saveExamResult({
            examSetId: e.partId ?? null,
            skill: "writing",
            correct: partScoreRounded,
            total: partMaxRounded,
            perQuestion: e.perQuestion,
            fullTestSessionId: sessionIdRef.current,
            fullTestId: testId,
            reviewSnapshot: writingSnap,
          });
        }
        lastTestResultId = testResultId;
        lastExamSetId = e.partId ?? null;

        if (user && testResultId) {
          await (supabase as any).from("writing_question_gradings").upsert([{
            user_id: user.id,
            test_result_id: testResultId,
            exam_set_id: e.partId,
            part: e.partType,
            item_index: 0,
            max_points: 30,
            part_score: v2.rawPart,
            grammar_errors: (v2.grammarErrors || []) as any,
            spelling_errors: (v2.spellingErrors || []) as any,
            feedback: v2.feedback || "",
          }], { onConflict: "test_result_id,part,item_index" });
        }

        setWritingGradedCount(i + 1);
      }

      if (failedParts > 0) {
        toast.error(
          failedParts === 1
            ? "Một phần chưa chấm được, vui lòng thử lại."
            : `${failedParts} phần chưa chấm được, vui lòng thử lại.`,
        );
      }

      // Finalize → scale50 + CEFR + grey_zone + flag_review (+ appropriacy cap)
      // ONLY when all 4 writing parts graded. Partial attempts must not
      // produce an official CEFR — raw_total/120*50 would collapse to A1.
      const { hasAllFourWritingParts } = await import("@/components/writing/writingGradingV2");
      const allFour = hasAllFourWritingParts(rawParts) && failedParts === 0;
      let scale50 = 0, cefr = "A0", greyZone = false, flagReview = false, rawTotal = 0;
      if (allFour) {
        try {
          const f = await finalizeWriting(rawParts, null, anyForcedComplexity);
          scale50 = f.scale50; cefr = f.cefr; greyZone = f.greyZone; flagReview = f.flagReview; rawTotal = f.rawTotal;
        } catch (err) {
          console.warn("[FullTest v2] finalizeWriting failed", err);
        }

        // Save aggregate writing_skill_results
        try {
          await saveWritingSkillResult({
            testResultId: lastTestResultId,
            examSetId: lastExamSetId,
            fullTestSessionId: sessionIdRef.current,
            parts: partsPayload,
            rawTotal, scale50, cefr, greyZone, flagReview,
          });
        } catch (err) {
          console.warn("[FullTest v2] saveWritingSkillResult failed", err);
        }

        // Patch last test_results row → score=scale50, total=50, level=cefr
        try {
          if (lastTestResultId) {
            await supabase.from("test_results").update({
              score: scale50, total: 50, level: cefr, correct_answers: scale50,
            } as any).eq("id", lastTestResultId);
          }
        } catch (err) { console.warn("[FullTest v2] update test_results failed", err); }
      } else {
        console.info("[FullTest v2] Incomplete writing attempt — skipping scale50/CEFR finalize.");
      }


      setScores((prev) => ({
        ...prev,
        writing: { correct: scale50, total: 50 },
      }));
      setPhase("completed");
    };


    const handleWritingPartComplete = (
      perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }>,
    ) => {
      if (adminNavigationRef.current) return;

      // Attach perQuestion (text answers) to the stored submission for this part.
      // No test_results row is created here — grading + persistence happen in runWritingFinalize.
      const existing = writingSubmissionsByPartRef.current[currentPartIndex];
      if (existing) {
        writingSubmissionsByPartRef.current[currentPartIndex] = { ...existing, perQuestion };
      }

      if (!isLastWritingPart) {
        // Just advance to the next writing part — do NOT call handlePartComplete
        // (which would add 0 to scores.writing and clobber the AI total later).
        const key = `writing-${currentPartIndex}`;
        if (completedKeysRef.current.has(key)) return;
        completedKeysRef.current.add(key);
        setCurrentPartIndex((p) => p + 1);
        return;
      }

      // Last writing part → finalize: grade everything, persist per-part rows, move to completed
      const key = `writing-${currentPartIndex}`;
      if (completedKeysRef.current.has(key)) return;
      completedKeysRef.current.add(key);
      setPhase("finalizing-writing");
      void runWritingFinalize();
    };

    return (
      <>
        {progressBar}
        {adminOverlay}
        <WritingExamEngine
          key="writing-full"
          partType={partType}
          testTitle={`${testTitle} – Writing ${currentPart.part}`}
          timeLimit={SKILL_TIMES.writing}
          externalTimeLeft={writingTimeLeft}
          onTimeTick={(t) => setWritingTimeLeft(t)}
          skipIntro={currentPartIndex > 0}
          fullFlow
          isLastPart={isLastWritingPart}
          onExit={handleExit}
          onPartAnswers={handleWritingPartAnswers}
          onComplete={handleWritingPartComplete}
          onAnswersChange={(a) => { writingRawAnswersByPartRef.current[currentPartIndex] = a; }}
          onPrevious={canGoBackPart ? handleAdminBackPart : undefined}
          {...writingProps}
        />
      </>
    );
  }

  return null;
};

export default FullTestEngine;
