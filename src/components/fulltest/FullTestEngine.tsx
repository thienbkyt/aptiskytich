import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Mic, Headphones, Brain, BookOpen, PenLine, Trophy } from "lucide-react";
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
import { saveTestResult } from "@/lib/testResults";
import { saveExamResult } from "@/lib/saveExamResult";
import { getLevel, getLevelColor } from "@/data/questions";
import { useAuth } from "@/hooks/useAuth";

import SpeakingExamEngine, { type SpeakingPartSubmission } from "@/components/speaking/SpeakingExamEngine";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import AdminExamControls from "@/components/exam/AdminExamControls";
import { normalizePart } from "@/hooks/useExamSets";
import { gradeSpeakingItems, saveSpeakingGradings } from "@/components/speaking/speakingGrading";
import { useExamGrading, type WritingGradingResult } from "@/hooks/useExamGrading";

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
  const savedRef = useRef(false);
  // Prevent double-advancing if a child engine fires onComplete twice
  // (e.g. timer + finish-button race). Keyed by `${skill}-${partIndex}`.
  const completedKeysRef = useRef<Set<string>>(new Set());
  const adminNavigationRef = useRef(false);
  const { isAdmin } = useAuth();
  // Unique id for this Full Test attempt — groups all 5 skills' rows in /history.
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Background grading state for Speaking in Full Test
  const speakingDataByPartRef = useRef<Record<number, { sub: SpeakingPartSubmission; partId: string | null; partLabel: string }>>({});
  const [speakingGradingPending, setSpeakingGradingPending] = useState(false);
  const speakingGradingStartedRef = useRef(false);
  const speakingGradingPromiseRef = useRef<Promise<void> | null>(null);

  // Writing grading state for Full Test (graded at the very end after writing's last part)
  const writingSubmissionsByPartRef = useRef<Record<number, { partType: string; text: string; questions: string[]; partId: string | null; partLabel: string }>>({});
  const [writingGradedCount, setWritingGradedCount] = useState(0);
  const [writingTotalToGrade, setWritingTotalToGrade] = useState(0);
  const [waitingForSpeaking, setWaitingForSpeaking] = useState(false);
  const { gradeExam } = useExamGrading();


  // Persist final result once when the user finishes the full test.
  useEffect(() => {
    if (phase !== "completed" || savedRef.current) return;
    savedRef.current = true;
    const totalCorrect = Object.values(scores).reduce((s, v) => s + v.correct, 0);
    const totalQ = Object.values(scores).reduce((s, v) => s + v.total, 0);
    if (totalQ === 0) return;
    const skillScores: Record<string, { correct: number; total: number }> = {};
    SKILL_ORDER.forEach((sk) => { skillScores[sk] = scores[sk]; });
    saveTestResult({
      correct: totalCorrect,
      total: totalQ,
      skill: "full_test",
      testId: testId,
      skillScores,
    });
  }, [phase, scores, testId]);

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
      saveExamResult({
        examSetId,
        skill: skill === "grammar" ? "grammar_vocab" : skill,
        correct, total,
        perQuestion,
        fullTestSessionId: sessionIdRef.current,
        fullTestId: testId,
      });
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

  // ── Completed ──
  if (phase === "completed") {
    const totalCorrect = Object.values(scores).reduce((s, v) => s + v.correct, 0);
    const totalQ = Object.values(scores).reduce((s, v) => s + v.total, 0);
    const skillPercents = SKILL_ORDER
      .map((sk) => scores[sk])
      .filter((s) => s.total > 0)
      .map((s) => s.correct / s.total);
    const avgPct = skillPercents.length
      ? skillPercents.reduce((a, b) => a + b, 0) / skillPercents.length
      : 0;
    const overallLevel = totalQ > 0 ? getLevel(Math.round(avgPct * 100), 100) : "—";

    const handleScrollTo = (id: string) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
      <div className="min-h-[70vh] pb-16">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>

        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Hoàn thành bài thi thử!</h2>
          <p className="text-muted-foreground mb-4">{testTitle}</p>
          {totalQ > 0 && (
            <div className="inline-flex items-center gap-2 bg-muted rounded-xl px-5 py-3">
              <span className="text-sm font-medium text-muted-foreground">Trình độ tổng thể:</span>
              <span className={`text-lg font-heading font-extrabold ${getLevelColor(overallLevel)}`}>{overallLevel}</span>
              {totalQ > 0 && (
                <span className="text-sm text-muted-foreground ml-2">• {totalCorrect}/{totalQ}</span>
              )}
            </div>
          )}
        </div>

        {/* Skill summary cards */}
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {SKILL_ORDER.map((skill) => {
            const s = scores[skill];
            const Icon = SKILL_ICONS[skill];
            const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            const lvl = s.total > 0 ? getLevel(s.correct, s.total) : null;
            return (
              <button
                key={skill}
                onClick={() => handleScrollTo(`skill-${skill}`)}
                className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-2" />
                <p className="text-xs font-semibold text-foreground mb-1">{SKILL_LABELS[skill]}</p>
                {skill === "speaking" && speakingGradingPending ? (
                  <p className="text-xs text-muted-foreground italic">
                    <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                    AI Kỳ Tích đang chấm...
                  </p>
                ) : s.total > 0 ? (
                  <>
                    <p className="text-lg font-heading font-bold text-foreground">
                      {s.correct}/{s.total}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{pct}% • <span className={`font-bold ${lvl ? getLevelColor(lvl) : ""}`}>{lvl}</span></p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Per-skill review sections */}
        <div className="max-w-4xl mx-auto space-y-8">
          {SKILL_ORDER.map((skill) => {
            const s = scores[skill];
            const Icon = SKILL_ICONS[skill];
            const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            const lvl = s.total > 0 ? getLevel(s.correct, s.total) : null;
            return (
              <section
                key={skill}
                id={`skill-${skill}`}
                className="bg-card border border-border rounded-xl p-6 scroll-mt-20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-heading font-bold text-foreground">{SKILL_LABELS[skill]}</h3>
                  </div>
                  {s.total > 0 && !(skill === "speaking" && speakingGradingPending) && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{s.correct}/{s.total} • {pct}%</p>
                      {lvl && <p className={`text-xs font-bold ${getLevelColor(lvl)}`}>Band {lvl}</p>}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {skill === "speaking" && speakingGradingPending
                    ? "AI Kỳ Tích đang chấm phần Speaking... Kết quả sẽ hiện ngay khi xong."
                    : s.total > 0
                    ? `Bạn đã hoàn thành phần ${SKILL_LABELS[skill]}. Xem chi tiết từng câu trong phần Lịch sử làm bài.`
                    : `Không có dữ liệu cho phần này.`}
                </p>
              </section>
            );
          })}
        </div>

        <div className="text-center mt-8">
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

        let totalScore = 0;
        let totalMax = 0;
        for (const e of orderedEntries) {
          totalMax += e.sub.items.reduce((s, it) => s + (it.spec.maxPoints || 0), 0);
        }

        // Grade each part's items in parallel
        const perPartResults: Awaited<ReturnType<typeof gradeSpeakingItems>>[] = [];
        for (const entry of orderedEntries) {
          const specs = entry.sub.items.map((i) => i.spec);
          const blobs = entry.sub.items.map((i) => i.blob);
          const actuals = entry.sub.items.map((i) => i.actualSpoken);
          const results = await gradeSpeakingItems(specs, blobs, actuals);
          for (const r of results) if (r && !("error" in r)) totalScore += r.partScore || 0;
          perPartResults.push(results);
        }

        // Persist one aggregate speaking test_results row (gets linked to History)
        const totalRounded = Math.round(totalScore);
        const maxRounded = Math.max(Math.round(totalMax), 1);
        const testResultId = await saveExamResult({
          examSetId: orderedEntries[0]?.partId ?? null,
          skill: "speaking",
          correct: totalRounded,
          total: maxRounded,
          fullTestSessionId: sessionIdRef.current,
          fullTestId: testId,
        });

        // Save per-question gradings linked to that row
        for (let i = 0; i < orderedEntries.length; i++) {
          const entry = orderedEntries[i];
          const results = perPartResults[i];
          await saveSpeakingGradings({
            testResultId,
            examSetId: entry.partId,
            partLabel: entry.partLabel,
            gradings: results,
            questionTexts: entry.sub.items.map((it) => it.spec.questionText),
          });
        }

        setScores((prev) => ({
          ...prev,
          speaking: { correct: totalRounded, total: maxRounded },
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
        void runSpeakingGradingBackground();
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
          testTitle={`${testTitle} – Reading ${currentPart.part}`}
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
          isLastPart={currentPartIndex >= partsForSkill.length - 1}
          onExit={handleExit}
          onComplete={(perQuestion) => handlePartComplete(0, perQuestion?.length || 0, perQuestion)}
          onPrevious={canGoBackPart ? handleAdminBackPart : undefined}
          {...writingProps}
        />
      </>
    );
  }

  return null;
};

export default FullTestEngine;
