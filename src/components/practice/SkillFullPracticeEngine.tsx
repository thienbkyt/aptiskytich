import { useState, useEffect, useCallback, useRef } from "react";
import { useExitWarning } from "@/hooks/useExitWarning";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, normalizePart, type ExamQuestionRow } from "@/hooks/useExamSets";
import type { ReadingAnswersState } from "@/components/reading/ReadingExamEngine";
import {
  toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4,
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
  toGrammarQuestions,
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
  toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4,
} from "@/lib/examTransformers";

import SpeakingExamEngine, { type SpeakingPartSubmission } from "@/components/speaking/SpeakingExamEngine";
import SpeakingFullResults, { type SpeakingFullPartResult } from "@/components/speaking/SpeakingFullResults";
import { gradeSpeakingSpec, saveSpeakingGradings } from "@/components/speaking/speakingGrading";
import {
  gradeSpeakingPartV2,
  finalizeSpeaking,
  saveSpeakingSkillResult,
  type SpeakingPartResultV2,
} from "@/components/speaking/speakingGradingV2";
import SpeakingFullResultsV2, { type SpeakingV2PartEntry } from "@/components/speaking/SpeakingFullResultsV2";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import ReadingFullResults, { type ReadingFullPartResult } from "@/components/reading/ReadingFullResults";
import ListeningFullResults, { type ListeningFullPartResult } from "@/components/listening/ListeningFullResults";
import WritingFullResults from "@/components/writing/WritingFullResults";
import { gradeWritingPartV2, finalizeWriting, saveWritingSkillResult } from "@/components/writing/writingGradingV2";
import { useExamGrading, type WritingGradingResult } from "@/hooks/useExamGrading";
import { saveExamResult, saveSpeakingRecording } from "@/lib/saveExamResult";
import { toast } from "sonner";
import { safeRandomId } from "@/lib/browserCompat";

type SkillType = "speaking" | "listening" | "grammar_vocab" | "reading" | "writing";

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar_vocab: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};

const SKILL_TIMES: Record<string, number> = {
  speaking: 720,
  listening: 2400,
  grammar_vocab: 1500,
  reading: 2100,
  writing: 3000,
};

interface PartSet {
  id: string;
  part: string;
  partNorm: string;
  questions: ExamQuestionRow[];
}

interface SkillFullPracticeEngineProps {
  fullTestId: string;
  skill: SkillType;
  testTitle: string;
  onExit: () => void;
  skipFirstIntro?: boolean;
}

type FlowPhase = "loading" | "exam" | "completed";

const SkillFullPracticeEngine = ({ fullTestId, skill, testTitle, onExit, skipFirstIntro }: SkillFullPracticeEngineProps) => {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [parts, setParts] = useState<PartSet[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [scores, setScores] = useState({ correct: 0, total: 0 });
  const [engineKey, setEngineKey] = useState(0);
  const [writingTimeLeft, setWritingTimeLeft] = useState(SKILL_TIMES.writing);
  const [listeningTimeLeft, setListeningTimeLeft] = useState(SKILL_TIMES.listening);
  const [readingTimeLeft, setReadingTimeLeft] = useState<number | null>(null);
  const adminNavigationRef = useRef(false);
  const lastNavDirectionRef = useRef<"forward" | "back">("forward");
  const fullPartSessionRef = useRef<string>(
    safeRandomId("full_part_session")
  );

  // Reading full-practice: keep per-part answers + results so user can revisit/edit
  // previous parts without losing data; final score sums latest result per part.
  const readingAnswersByPartRef = useRef<Record<number, ReadingAnswersState>>({});
  const readingResultsByPartRef = useRef<Record<number, { correct: number; total: number }>>({});
  const [readingPhase, setReadingPhase] = useState<"none" | "results">("none");
  const [readingFullParts, setReadingFullParts] = useState<ReadingFullPartResult[]>([]);
  const [readingScore50, setReadingScore50] = useState(0);

  // Listening full-practice: same pattern as reading
  const listeningAnswersByPartRef = useRef<Record<number, any[]>>({});
  const listeningResultsByPartRef = useRef<Record<number, { correct: number; total: number }>>({});
  const [listeningPhase, setListeningPhase] = useState<"none" | "results">("none");
  const [listeningFullParts, setListeningFullParts] = useState<ListeningFullPartResult[]>([]);
  const [listeningScore50, setListeningScore50] = useState(0);

  // Writing full-practice grading state
  const writingPartsRef = useRef<Array<{ partType: string; text: string; questions: string[] }>>([]);
  const writingAnswersByPartRef = useRef<Record<number, {
    shortAnswers: string[]; textAnswer: string; part3Answers: string[]; informalAnswer: string; formalAnswer: string;
  }>>({});
  const writingSubmissionsByPartRef = useRef<Record<number, { partType: string; text: string; questions: string[] }>>({});
  const [writingPhase, setWritingPhase] = useState<"none" | "grading" | "results">("none");
  const [writingGradedCount, setWritingGradedCount] = useState(0);
  const [writingResults, setWritingResults] = useState<WritingGradingResult[]>([]);
  const [writingScore50, setWritingScore50] = useState(0);
  const [writingCefr, setWritingCefr] = useState<string>("");
  const { gradeExam } = useExamGrading();

  // Speaking full-practice grading state
  const speakingSubmissionsByPartRef = useRef<Record<number, SpeakingPartSubmission>>({});
  const speakingTestResultIdByPartRef = useRef<Record<number, string | null>>({});
  const speakingSessionStartIsoRef = useRef<string>(new Date().toISOString());
  const speakingGradingPromisesByPartRef = useRef<
    Record<number, Promise<Awaited<ReturnType<typeof gradeSpeakingSpec>>[]>>
  >({});
  // V2 background grading promises keyed by part index.
  const speakingV2PromisesByPartRef = useRef<
    Record<number, Promise<SpeakingPartResultV2>>
  >({});
  const [speakingPhase, setSpeakingPhase] = useState<"none" | "grading" | "results">("none");
  const [speakingGradedCount, setSpeakingGradedCount] = useState(0);
  const [speakingGradeTotal, setSpeakingGradeTotal] = useState(0);
  const [speakingFullParts, setSpeakingFullParts] = useState<SpeakingFullPartResult[]>([]);
  const [speakingTotalScore, setSpeakingTotalScore] = useState(0);
  const [speakingTotalMax, setSpeakingTotalMax] = useState(0);
  const [speakingV2Parts, setSpeakingV2Parts] = useState<SpeakingV2PartEntry[]>([]);
  const [speakingV2Scale, setSpeakingV2Scale] = useState(0);
  const [speakingV2Cefr, setSpeakingV2Cefr] = useState("");
  const [speakingV2GreyZone, setSpeakingV2GreyZone] = useState(false);
  const [speakingV2FlagReview, setSpeakingV2FlagReview] = useState(false);
  const [speakingV2RawTotal, setSpeakingV2RawTotal] = useState(0);
  const [speakingV2Message, setSpeakingV2Message] = useState("");
  useExitWarning(phase !== "loading" && phase !== "completed");


  const skillLabel = SKILL_LABELS[skill] || skill;
  const timeLimit = SKILL_TIMES[skill] || 1800;

  useEffect(() => {
    loadData();
  }, [fullTestId, skill]);

  const loadData = async () => {
    setPhase("loading");

    const { data: sets } = await supabase
      .from("exam_sets")
      .select("id, part, skill")
      .eq("full_test_id", fullTestId)
      .eq("skill", skill)
      .eq("is_published", true)
      .order("part", { ascending: true });

    if (!sets || sets.length === 0) {
      setPhase("completed");
      return;
    }

    const setsWithQuestions = await Promise.all(
      sets.map(async (s) => {
        const questions = await fetchExamQuestions(s.id);
        return { ...s, questions, partNorm: normalizePart(s.part) };
      })
    );

    // Sort by part
    setsWithQuestions.sort((a, b) => a.part.localeCompare(b.part));

    setParts(setsWithQuestions);
    if (skill === "reading") setReadingTimeLeft(SKILL_TIMES.reading);
    setPhase("exam");
  };

  const handlePartComplete = useCallback((
    correct?: number,
    total?: number,
    perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }>
  ) => {
    if (adminNavigationRef.current) return;
    if (correct !== undefined && total !== undefined) {
      if (skill === "reading") {
        // Overwrite latest result for this part; recompute total from map (no double-count on revisit).
        readingResultsByPartRef.current[currentPartIndex] = { correct, total };
        const agg = Object.values(readingResultsByPartRef.current).reduce(
          (acc, r) => ({ correct: acc.correct + r.correct, total: acc.total + r.total }),
          { correct: 0, total: 0 }
        );
        setScores(agg);
      } else if (skill === "listening") {
        listeningResultsByPartRef.current[currentPartIndex] = { correct, total };
        const agg = Object.values(listeningResultsByPartRef.current).reduce(
          (acc, r) => ({ correct: acc.correct + r.correct, total: acc.total + r.total }),
          { correct: 0, total: 0 }
        );
        setScores(agg);
      } else {
        setScores(prev => ({
          correct: prev.correct + correct,
          total: prev.total + total,
        }));
      }
      // Persist for the current part's exam_set
      const setIdForGrammar = parts[0]?.id ?? null;
      const examSetId = skill === "grammar_vocab" ? setIdForGrammar : (parts[currentPartIndex]?.id ?? null);
      (async () => {
        const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
        const {
          buildGrammarItems, buildReadingItems, buildListeningItems, computeScaleAndBand,
        } = await import("@/lib/reviewItemsBuilder");
        const partNorm = parts[currentPartIndex]?.partNorm ?? null;
        const partQuestions = parts[currentPartIndex]?.questions ?? [];
        let items: any[] = [];
        if (skill === "grammar_vocab") {
          items = buildGrammarItems(partQuestions, perQuestion || []);
        } else if (skill === "reading" && partNorm) {
          // Need engineData for reading items. Use what's stored on the part.
          const engineData: any = {};
          // Best-effort: derive from partQuestions via transformers
          try {
            const { toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4 } = await import("@/lib/examTransformers");
            if (partNorm === "part1") engineData.part1Question = toReadingPart1(partQuestions);
            else if (partNorm === "part2") engineData.part2Question = toReadingPart2(partQuestions);
            else if (partNorm === "part3") engineData.part3Question = toReadingPart3(partQuestions);
            else if (partNorm === "part4") engineData.part4Question = toReadingPart4(partQuestions);
            items = buildReadingItems(partNorm as any, engineData, {}, {}, perQuestion || []);
          } catch { /* noop */ }
        } else if (skill === "listening" && partNorm) {
          const engineData: any = {};
          try {
            const { toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4 } = await import("@/lib/examTransformers");
            if (partNorm === "part1") engineData.part1Questions = toListeningPart1(partQuestions);
            else if (partNorm === "part2") engineData.part2Questions = toListeningPart2(partQuestions);
            else if (partNorm === "part3") engineData.part3Questions = toListeningPart3(partQuestions);
            else if (partNorm === "part4") engineData.part4Questions = toListeningPart4(partQuestions);
            items = buildListeningItems(partNorm as any, engineData, {}, perQuestion || []);
          } catch { /* noop */ }
        }
        const { scaled50, band } = computeScaleAndBand(skill === "grammar_vocab" ? "grammar" : skill, correct, total);
        const snap = buildReviewSnapshot({
          skill, part: partNorm, testTitle,
          score: correct, total, scaled50, band,
          items,
          raw: { skill, partType: partNorm, questions: partQuestions, perQuestion: perQuestion || [] },
        });
        saveExamResult({
          examSetId, skill,
          correct, total,
          perQuestion,
          reviewSnapshot: snap,
          fullTestSessionId: fullPartSessionRef.current,
          extraSkillScores: { fullPartSession: fullPartSessionRef.current, label: testTitle },
        });
      })();
    }

    const isGrammar = skill === "grammar_vocab";
    const isLast = currentPartIndex >= parts.length - 1;
    if (skill === "reading" && isLast) {
      // Build per-part snapshot for the full-results screen
      const built: ReadingFullPartResult[] = parts.map((pt, idx) => {
        const partType = pt.partNorm as "part1" | "part2" | "part3" | "part4";
        const res = readingResultsByPartRef.current[idx] || { correct: 0, total: 0 };
        const ans = readingAnswersByPartRef.current[idx] || { p1: [], p2: [], p3: [], p4: [] };
        const entry: ReadingFullPartResult = {
          partType,
          correct: res.correct,
          total: res.total,
          examSetId: pt.id,
          answers: ans,
        };
        if (partType === "part1") entry.part1Question = toReadingPart1(pt.questions);
        else if (partType === "part2") entry.part2Question = toReadingPart2(pt.questions);
        else if (partType === "part3") entry.part3Question = toReadingPart3(pt.questions);
        else if (partType === "part4") entry.part4Question = toReadingPart4(pt.questions);
        return entry;
      });
      const totalCorrect = built.reduce((s, p) => s + p.correct, 0);
      const totalQs = built.reduce((s, p) => s + p.total, 0);
      const score50 = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 50) : 0;
      setReadingFullParts(built);
      setReadingScore50(score50);
      setReadingPhase("results");
      return;
    }
    if (skill === "listening" && isLast) {
      const built: ListeningFullPartResult[] = parts.map((pt, idx) => {
        const partType = pt.partNorm as ListeningPartType;
        const res = listeningResultsByPartRef.current[idx] || { correct: 0, total: 0 };
        const ans = listeningAnswersByPartRef.current[idx] || [];
        const entry: ListeningFullPartResult = {
          partType,
          correct: res.correct,
          total: res.total,
          examSetId: pt.id,
          answers: ans,
        };
        if (partType === "part1") entry.part1Questions = toListeningPart1(pt.questions);
        else if (partType === "part2") entry.part2Questions = toListeningPart2(pt.questions);
        else if (partType === "part3") entry.part3Questions = toListeningPart3(pt.questions);
        else if (partType === "part4") entry.part4Questions = toListeningPart4(pt.questions);
        return entry;
      });
      const totalCorrect = built.reduce((s, p) => s + p.correct, 0);
      const totalQs = built.reduce((s, p) => s + p.total, 0);
      const score50 = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 50) : 0;
      setListeningFullParts(built);
      setListeningScore50(score50);
      setListeningPhase("results");
      return;
    }
    const engineHandlesResults = isGrammar || (isLast && (skill === "listening" || skill === "writing"));
    if (engineHandlesResults) {
      return;
    }
    if (isLast) {
      setPhase("completed");
    } else {
      lastNavDirectionRef.current = "forward";
      setCurrentPartIndex(prev => prev + 1);
      if (skill !== "writing" && skill !== "listening") {
        setEngineKey(prev => prev + 1);
      }
    }
  }, [currentPartIndex, parts, skill]);

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu bài luyện tập...</p>
      </div>
    );
  }

  // ── Completed ──
  if (phase === "completed") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <div className="max-w-xl mx-auto text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            Hoàn thành luyện tập {skillLabel}!
          </h2>
          <p className="text-muted-foreground mb-6">{testTitle}</p>
          {scores.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-foreground">Tổng điểm</span>
                <span className="text-primary">{scores.correct}/{scores.total}</span>
              </div>
            </div>
          )}
          <Button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Quay lại danh sách đề
          </Button>
        </div>
      </div>
    );
  }

  // ── Admin-only part navigation overlay (within current skill) ──
  const adminOverlay = null;

  const handleAdminPreviousPart = currentPartIndex > 0 ? () => {
    adminNavigationRef.current = true;
    window.setTimeout(() => { adminNavigationRef.current = false; }, 800);
    lastNavDirectionRef.current = "back";
    setCurrentPartIndex((p) => Math.max(0, p - 1));
    setEngineKey((k) => k + 1);
  } : undefined;

  // ── Exam Phase ──
  if (parts.length === 0) return null;

  const headerTitle = skill === "reading" ? "Reading Đề 01" : `${skillLabel} - Full Practice`;

  // Grammar: merge all parts
  if (skill === "grammar_vocab") {
    const allQuestions = parts.flatMap(p => p.questions);
    const grammarQuestions = toGrammarQuestions(allQuestions);
    return (
      <>{adminOverlay}
      <GrammarExamEngine
        key={`grammar-${engineKey}`}
        questions={grammarQuestions}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        onExit={onExit}
        onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
        onPreviousPart={handleAdminPreviousPart}
        showResultsOnSubmit
        allowReveal
      /></>
    );
  }

  const currentPart = parts[currentPartIndex];
  if (!currentPart) return null;
  const partNorm = currentPart.partNorm;
  const isLastPart = currentPartIndex >= parts.length - 1;

  // Progress indicator removed — engines render full-screen like individual parts

  if (skill === "speaking") {
    if (speakingPhase === "results") {
      return (
        <SpeakingFullResultsV2
          parts={speakingV2Parts}
          scale50={speakingV2Scale}
          cefr={speakingV2Cefr}
          greyZone={speakingV2GreyZone}
          flagReview={speakingV2FlagReview}
          rawTotal={speakingV2RawTotal}
          onExit={onExit}
        />
      );
    }
    if (speakingPhase === "grading") {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            AI Kỳ Tích đang chấm Speaking 5 tiêu chí — đừng thoát hay đổi tab nha.
          </p>
          {speakingV2Message && (
            <p className="text-xs text-muted-foreground">{speakingV2Message}</p>
          )}
        </div>
      );
    }


    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const speakingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": speakingProps.part1Data = toSpeakingPart1(currentPart.questions); break;
      case "part2": speakingProps.part2Data = toSpeakingPart2(currentPart.questions); break;
      case "part3": speakingProps.part3Data = toSpeakingPart3(currentPart.questions); break;
      case "part4": speakingProps.part4Data = toSpeakingPart4(currentPart.questions); break;
    }

    const handleSpeakingPartSubmissions = (sub: SpeakingPartSubmission) => {
      speakingSubmissionsByPartRef.current[currentPartIndex] = sub;
    };

    // Grade all items of a single part in parallel; increments speakingGradedCount
    // as each item completes (functional setState so multiple parts can stream safely).
    const gradePartItems = async (
      sub: SpeakingPartSubmission,
    ): Promise<Awaited<ReturnType<typeof gradeSpeakingSpec>>[]> => {
      const results: Awaited<ReturnType<typeof gradeSpeakingSpec>>[] =
        new Array(sub.items.length).fill(null) as any;
      await Promise.all(
        sub.items.map(async (item, idx) => {
          if (!item.audioBase64) {
            results[idx] = { error: "Không có bài ghi âm" };
          } else {
            results[idx] = await gradeSpeakingSpec(item.spec, item.audioBase64, item.actualSpoken);
          }
          setSpeakingGradedCount((c) => c + 1);
        }),
      );
      return results;
    };

    const handleSpeakingPartComplete = async () => {
      if (adminNavigationRef.current) return;
      // Persist a per-part attempt (no score yet) so HistoryDetail can list it.
      const perQuestion = currentPart.questions.map((q) => ({
        exam_question_id: q.id,
        user_answer: "(recorded)",
        is_correct: false,
      }));
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { buildSpeakingItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const promptsList: string[] = (() => {
        try {
          const q = (currentPart.questions?.[0] as any) || {};
          if (Array.isArray(q.questions)) return q.questions;
        } catch { /* noop */ }
        return currentPart.questions.map((_, i) => `Question ${i + 1}`);
      })();
      const specs = perQuestion.map((_, idx) => ({
        questionText: promptsList[idx] || `Question ${idx + 1}`,
        recordingPath: null,
        ai: null,
      }));
      const { scaled50, band } = computeScaleAndBand("speaking", 0, perQuestion.length);
      const snap = buildReviewSnapshot({
        skill: "speaking",
        part: currentPart.partNorm,
        testTitle,
        score: 0, total: perQuestion.length,
        scaled50, band,
        items: buildSpeakingItems(specs),
        raw: {
          partType: currentPart.partNorm,
          questions: currentPart.questions,
          perQuestion,
        },
      });
      const _trId = await saveExamResult({
        examSetId: currentPart.id,
        skill: "speaking",
        correct: 0,
        total: perQuestion.length,
        perQuestion,
        reviewSnapshot: snap,
        fullTestSessionId: fullPartSessionRef.current,
        extraSkillScores: { fullPartSession: fullPartSessionRef.current, label: testTitle },
      });
      speakingTestResultIdByPartRef.current[currentPartIndex] = _trId ?? null;

      // Back-fill test_result_id on speaking_recordings saved during this part
      try {
        if (_trId && currentPart.id) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await supabase.from("speaking_recordings")
              .update({ test_result_id: _trId })
              .eq("user_id", user.id)
              .eq("exam_set_id", currentPart.id)
              .is("test_result_id", null)
              .gte("created_at", speakingSessionStartIsoRef.current);
          }
        }
      } catch { /* swallow */ }

      // Kick off V2 grading IN BACKGROUND for the part just finished,
      // so by the time the student reaches the last part most grading is done.
      try {
        const sub = speakingSubmissionsByPartRef.current[currentPartIndex];
        if (sub && !speakingV2PromisesByPartRef.current[currentPartIndex]) {
          const questions = sub.items.map((it) => ({ questionText: it.spec.questionText }));
          const blobs = sub.items.map((it) => it.blob ?? null);
          speakingV2PromisesByPartRef.current[currentPartIndex] =
            gradeSpeakingPartV2(sub.partType, questions, blobs, {
              sessionId: fullPartSessionRef.current,
              fullTestSessionId: fullPartSessionRef.current,
              testResultId: speakingTestResultIdByPartRef.current[currentPartIndex] ?? null,
            });
        }
      } catch (e) {
        console.warn("[SkillFullPractice V2] background kick failed", e);
      }

      if (!isLastPart) {
        lastNavDirectionRef.current = "forward";
        setCurrentPartIndex((p) => p + 1);
        return;
      }

      // Last part → grade all 4 parts with V2, finalize, save one row.
      setSpeakingPhase("grading");
      setSpeakingV2Message("Đang khởi động AI Kỳ Tích...");

      const orderedIndices = Object.keys(speakingSubmissionsByPartRef.current)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);
      const orderedSubs = orderedIndices
        .map((i) => speakingSubmissionsByPartRef.current[i])
        .filter(Boolean) as SpeakingPartSubmission[];

      // 1) Upload recordings (best-effort, parallel across parts).
      try {
        await Promise.all(orderedSubs.map(async (sub, oi) => {
          const originalPartIdx = orderedIndices[oi];
          const originalPart = parts[originalPartIdx];
          if (!originalPart) return;
          await Promise.all(sub.items.map(async (item, idx) => {
            if (!item.blob) return;
            try {
              await saveSpeakingRecording({
                examSetId: originalPart.id,
                part: `${originalPart.partNorm}_q${idx + 1}`,
                blob: item.blob,
                durationSeconds: item.actualSpoken,
                testResultId: speakingTestResultIdByPartRef.current[originalPartIdx] ?? null,
              });
            } catch (e) {
              console.warn("[SkillFullPractice V2] saveSpeakingRecording failed", e);
            }
          }));
        }));
      } catch (e) {
        console.warn("[SkillFullPractice V2] recordings upload failed", e);
      }

      // 2) Await V2 grading per part (most were kicked off in background as parts completed).
      const v2ByPart: Record<string, SpeakingPartResultV2> = {};
      const v2Entries: SpeakingV2PartEntry[] = [];
      for (let oi = 0; oi < orderedSubs.length; oi++) {
        const sub = orderedSubs[oi];
        const originalIdx = orderedIndices[oi];
        setSpeakingV2Message(`AI Kỳ Tích đang hoàn tất Part ${sub.partNumber} (${oi + 1}/${orderedSubs.length})...`);
        const questions = sub.items.map((it) => ({ questionText: it.spec.questionText }));
        const blobs = sub.items.map((it) => it.blob ?? null);
        // Reuse background promise if available; else fire fresh.
        let pending = speakingV2PromisesByPartRef.current[originalIdx];
        if (!pending) {
          pending = gradeSpeakingPartV2(sub.partType, questions, blobs, {
            sessionId: fullPartSessionRef.current,
            fullTestSessionId: fullPartSessionRef.current,
            testResultId: speakingTestResultIdByPartRef.current[originalIdx] ?? null,
          });
          speakingV2PromisesByPartRef.current[originalIdx] = pending;
        }
        try {
          const result = await pending;
          const merged: SpeakingPartResultV2 = {
            ...result,
            perItem: (result.perItem || []).map((it, i) => ({
              ...it,
              questionText: it.questionText || sub.items[i]?.spec.questionText || `Question ${i + 1}`,
            })),
          };
          v2ByPart[sub.partType] = merged;
          v2Entries.push({
            partType: sub.partType as any,
            partNumber: sub.partNumber,
            result: merged,
            recordingUrls: sub.items.map((it) => it.audioUrl ?? null),
          });
        } catch (e) {
          console.warn(`[SkillFullPractice V2] gradeSpeakingPartV2 ${sub.partType} failed`, e);
          const empty: SpeakingPartResultV2 = {
            bands: { tf: "0", gra: "0", vra: "0", pro: "0", fc: "0" },
            rawPart: 0,
            perItem: sub.items.map((it) => ({
              questionText: it.spec.questionText,
              transcript: "",
              onTopic: false,
            })),
            analysis: "Không chấm được phần này. Vui lòng thử lại sau.",
            improvedVersion: "",
          };
          v2ByPart[sub.partType] = empty;
          v2Entries.push({
            partType: sub.partType as any,
            partNumber: sub.partNumber,
            result: empty,
            recordingUrls: sub.items.map((it) => it.audioUrl ?? null),
          });
        }
      }

      // 3) Finalize → /50 + CEFR + flags.
      setSpeakingV2Message("Đang tổng hợp điểm /50 và CEFR...");
      const rawParts = {
        part1: v2ByPart.part1?.rawPart ?? 0,
        part2: v2ByPart.part2?.rawPart ?? 0,
        part3: v2ByPart.part3?.rawPart ?? 0,
        part4: v2ByPart.part4?.rawPart ?? 0,
      };
      let scale50 = 0, cefr = "", greyZone = false, flagReview = false, rawTotal = 0;
      try {
        const f = await finalizeSpeaking(rawParts, null);
        scale50 = f.scale50; cefr = f.cefr; greyZone = f.greyZone; flagReview = f.flagReview; rawTotal = f.rawTotal;
      } catch (e) {
        console.warn("[SkillFullPractice V2] finalizeSpeaking failed", e);
      }

      // 4) Save ONE speaking_skill_results row with all 4 parts.
      const lastPartIdx = orderedIndices[orderedIndices.length - 1];
      const lastTrId = speakingTestResultIdByPartRef.current[lastPartIdx] ?? null;
      const lastExamSetId = parts[lastPartIdx]?.id ?? null;
      try {
        const partsPayload: Record<string, any> = {};
        for (const entry of v2Entries) {
          partsPayload[entry.partType] = {
            bands: entry.result.bands,
            items: entry.result.perItem,
            analysis: entry.result.analysis,
            criteriaAnalysis: entry.result.criteriaAnalysis,
            feedback: entry.result.feedback,
            improvedVersion: entry.result.improvedVersion,
            rawPart: entry.result.rawPart,
          };
        }
        await saveSpeakingSkillResult({
          testResultId: lastTrId,
          examSetId: lastExamSetId,
          fullTestSessionId: fullPartSessionRef.current,
          parts: partsPayload,
          rawTotal,
          scale50,
          cefr,
          greyZone,
          flagReview,
        });
      } catch (e) {
        console.warn("[SkillFullPractice V2] saveSpeakingSkillResult failed", e);
      }

      setSpeakingV2Parts(v2Entries);
      setSpeakingV2Scale(scale50);
      setSpeakingV2Cefr(cefr);
      setSpeakingV2GreyZone(greyZone);
      setSpeakingV2FlagReview(flagReview);
      setSpeakingV2RawTotal(rawTotal);
      setSpeakingPhase("results");
      // Align skill summary score with /50 (consistent with other skills).
      setScores({ correct: scale50, total: 50 });
    };


    return (
      <>{adminOverlay}
      <SpeakingExamEngine
        key={`speaking-${currentPartIndex}`}
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        examSetId={currentPart.id}
        onExit={onExit}
        fullFlow
        isLastPart={isLastPart}
        onPartSubmissions={handleSpeakingPartSubmissions}
        onComplete={handleSpeakingPartComplete}
        skipIntro={skipFirstIntro || currentPartIndex > 0}
        onAdminPrevious={handleAdminPreviousPart}
        allowReveal
        {...speakingProps}
      /></>
    );
  }


  if (skill === "listening") {
    if (listeningPhase === "results") {
      return (
        <ListeningFullResults
          parts={listeningFullParts}
          score50={listeningScore50}
          onExit={onExit}
          onRetry={() => {
            listeningAnswersByPartRef.current = {};
            listeningResultsByPartRef.current = {};
            setListeningFullParts([]);
            setListeningScore50(0);
            setScores({ correct: 0, total: 0 });
            setListeningTimeLeft(SKILL_TIMES.listening);
            lastNavDirectionRef.current = "forward";
            setCurrentPartIndex(0);
            setEngineKey((k) => k + 1);
            setListeningPhase("none");
          }}
        />
      );
    }
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const listeningProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": listeningProps.part1Questions = toListeningPart1(currentPart.questions); break;
      case "part2": listeningProps.part2Questions = toListeningPart2(currentPart.questions); break;
      case "part3": listeningProps.part3Questions = toListeningPart3(currentPart.questions); break;
      case "part4": listeningProps.part4Questions = toListeningPart4(currentPart.questions); break;
    }
    return (
      <>{adminOverlay}
      <ListeningExamEngine
        key={`listening-part-${currentPartIndex}`}
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        externalTimeLeft={listeningTimeLeft}
        onTimeTick={(t) => setListeningTimeLeft(t)}
        skipIntro={skipFirstIntro || currentPartIndex > 0}
        fullFlow
        allowReveal
        onExit={onExit}
        onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
        onPreviousPart={handleAdminPreviousPart}
        showResultsOnSubmit={false}
        initialAnswers={listeningAnswersByPartRef.current[currentPartIndex]}
        onAnswersChange={(a) => { listeningAnswersByPartRef.current[currentPartIndex] = a; }}
        enterAtLastQuestion={lastNavDirectionRef.current === "back"}
        {...listeningProps}
      /></>
    );
  }

  if (skill === "reading") {
    if (readingPhase === "results") {
      return (
        <ReadingFullResults
          parts={readingFullParts}
          score50={readingScore50}
          onExit={onExit}
          onRetry={() => {
            readingAnswersByPartRef.current = {};
            readingResultsByPartRef.current = {};
            setReadingFullParts([]);
            setReadingScore50(0);
            setScores({ correct: 0, total: 0 });
            setReadingTimeLeft(SKILL_TIMES.reading);
            lastNavDirectionRef.current = "forward";
            setCurrentPartIndex(0);
            setEngineKey((k) => k + 1);
            setReadingPhase("none");
          }}
        />
      );
    }
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const readingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partType) {
      case "part1": readingProps.part1Question = toReadingPart1(currentPart.questions); break;
      case "part2": readingProps.part2Question = toReadingPart2(currentPart.questions); break;
      case "part3": readingProps.part3Question = toReadingPart3(currentPart.questions); break;
      case "part4": readingProps.part4Question = toReadingPart4(currentPart.questions); break;
    }
    const readingPreviousPart = currentPartIndex > 0
      ? () => {
          lastNavDirectionRef.current = "back";
          setCurrentPartIndex((p) => Math.max(0, p - 1));
        }
      : undefined;
    return (
      <>{adminOverlay}
      <ReadingExamEngine
        key={`reading-part-${currentPartIndex}`}
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        initialTimeLeft={readingTimeLeft ?? SKILL_TIMES.reading}
        onTimeTick={(t) => setReadingTimeLeft(t)}
        skipIntro={skipFirstIntro || currentPartIndex > 0}
        fullFlow
        allowReveal
        onExit={onExit}
        onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
        onPreviousPart={readingPreviousPart}
        initialAnswers={readingAnswersByPartRef.current[currentPartIndex]}
        onAnswersChange={(a) => { readingAnswersByPartRef.current[currentPartIndex] = a; }}
        enterAtLastQuestion={lastNavDirectionRef.current === "back"}
        showResultsOnSubmit={false}
        {...readingProps}
      /></>
    );
  }

  if (skill === "writing") {
    // Writing full-practice: show results when grading completes
    if (writingPhase === "results") {
      // Build per-part review payloads aligned with writingResults order.
      const orderedIndices = Object.keys(writingSubmissionsByPartRef.current)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);
      const reviewParts = orderedIndices.map((idx, i) => {
        const pt = parts[idx];
        if (!pt) return null;
        const partNorm2 = pt.partNorm;
        const writingPartType = partNorm2.replace("part", "task") as "task1" | "task2" | "task3" | "task4";
        let partData: any = null;
        if (partNorm2 === "part1") partData = toWritingPart1(pt.questions);
        else if (partNorm2 === "part2") partData = toWritingPart2(pt.questions);
        else if (partNorm2 === "part3") partData = toWritingPart3(pt.questions);
        else if (partNorm2 === "part4") partData = toWritingPart4(pt.questions);
        const answers = writingAnswersByPartRef.current[idx] || {
          shortAnswers: [], textAnswer: "", part3Answers: [], informalAnswer: "", formalAnswer: "",
        };
        const grading = writingResults[i];
        if (!partData || !grading) return null;
        return { partType: writingPartType, partData, answers, grading };
      }).filter(Boolean) as any[];

      return (
        <WritingFullResults
          results={writingResults}
          score50={writingScore50}
          cefr={writingCefr}
          onExit={onExit}
          submissions={writingPartsRef.current}
          parts={reviewParts}
        />
      );
    }
    if (writingPhase === "grading") {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Đang chấm điểm... ({writingGradedCount}/{parts.length})
          </p>
        </div>
      );
    }

    const writingPartType = partNorm.replace("part", "task") as "task1" | "task2" | "task3" | "task4";
    const writingProps: any = { sourceQuestionIds: currentPart.questions.map(q => q.id) };
    switch (partNorm) {
      case "part1": writingProps.part1Data = toWritingPart1(currentPart.questions); break;
      case "part2": writingProps.part2Data = toWritingPart2(currentPart.questions); break;
      case "part3": writingProps.part3Data = toWritingPart3(currentPart.questions); break;
      case "part4": writingProps.part4Data = toWritingPart4(currentPart.questions); break;
    }

    const WRITING_PART_LABELS: Record<string, string> = {
      task1: "Part 1 – Short Answers",
      task2: "Part 2 – Social Media Response",
      task3: "Part 3 – Three Questions",
      task4: "Part 4 – Informal & Formal Email",
    };

    const handleWritingPartAnswers = (data: { partType: string; text: string; questions: string[] }) => {
      const prev = writingSubmissionsByPartRef.current[currentPartIndex] as any;
      writingSubmissionsByPartRef.current[currentPartIndex] = {
        ...data,
        // preserve partId/perQuestion/testResultId set in handleWritingPartComplete
        ...(prev ? { partId: prev.partId, perQuestion: prev.perQuestion, testResultId: prev.testResultId } : {}),
      } as any;
    };

    const writingPreviousPart = currentPartIndex > 0
      ? () => {
          lastNavDirectionRef.current = "back";
          setCurrentPartIndex((p) => Math.max(0, p - 1));
        }
      : undefined;

    const handleWritingPartComplete = async (perQuestion?: Array<{ exam_question_id: string; user_answer: string | null; is_correct: boolean }>) => {
      if (adminNavigationRef.current) return;
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const sub = (writingSubmissionsByPartRef.current[currentPartIndex] || {}) as any;
      const userText = (perQuestion?.[0]?.user_answer) || sub.text || "";
      const promptText = (sub.questions || []).join("\n\n") || currentPart.partNorm;
      const snap = buildReviewSnapshot({
        skill: "writing",
        part: currentPart.partNorm,
        testTitle,
        score: 0, total: 1,
        items: [{
          questionText: promptText,
          userAnswer: userText,
          isCorrect: false,
          ai: null,
        }],
        raw: {
          partType: currentPart.partNorm,
          questions: currentPart.questions,
          perQuestion: perQuestion || [],
        },
      });
      const trid = await saveExamResult({
        examSetId: currentPart.id,
        skill: "writing",
        correct: 0,
        total: perQuestion?.length || 0,
        perQuestion,
        reviewSnapshot: snap,
        fullTestSessionId: fullPartSessionRef.current,
        extraSkillScores: { fullPartSession: fullPartSessionRef.current, label: testTitle },
      });
      const existing = (writingSubmissionsByPartRef.current[currentPartIndex] || {}) as any;
      writingSubmissionsByPartRef.current[currentPartIndex] = {
        ...existing,
        partId: currentPart.id,
        perQuestion,
        testResultId: trid ?? null,
      } as any;

      if (!isLastPart) {
        lastNavDirectionRef.current = "forward";
        setCurrentPartIndex((p) => p + 1);
        return;
      }

      // Last part → grade all sequentially using v2 analytic rubric
      setWritingPhase("grading");
      setWritingGradedCount(0);
      const orderedIndices = Object.keys(writingSubmissionsByPartRef.current)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);
      const orderedSubmissions = orderedIndices
        .map((i) => writingSubmissionsByPartRef.current[i])
        .filter(Boolean) as Array<{ partType: string; text: string; questions: string[]; partId?: string; testResultId?: string | null }>;
      writingPartsRef.current = orderedSubmissions;

      const results: WritingGradingResult[] = [];
      const rawParts: { task1?: number; task2?: number; task3?: number; task4?: number } = {};
      const partsPayload: Record<string, any> = {};
      let anyForcedComplexity = false;
      let failedParts = 0;

      for (let i = 0; i < orderedSubmissions.length; i++) {
        const p = orderedSubmissions[i];
        const origIdx = orderedIndices[i];
        const answers = writingAnswersByPartRef.current[origIdx] || {
          shortAnswers: [], textAnswer: "", part3Answers: [], informalAnswer: "", formalAnswer: "",
        };
        const partsInput: any = {};
        if (p.partType === "task1") partsInput.shortAnswers = answers.shortAnswers;
        else if (p.partType === "task3") partsInput.threeAnswers = answers.part3Answers;
        else if (p.partType === "task4") {
          partsInput.informalText = answers.informalAnswer;
          partsInput.formalText = answers.formalAnswer;
        }
        try {
          const v2 = await gradeWritingPartV2(p.partType as any, p.questions, p.text, partsInput, {
            testResultId: (p as any).testResultId ?? null,
            examSetId: p.partId ?? null,
            fullTestSessionId: fullPartSessionRef.current,
          });
          rawParts[p.partType as keyof typeof rawParts] = v2.rawPart;
          if (v2.forcedComplexity) anyForcedComplexity = true;
          partsPayload[p.partType] = {
            bands: v2.bands, rawPart: v2.rawPart, perItem: v2.perItem,
            analysis: v2.analysis, criteriaAnalysis: v2.criteriaAnalysis,
            feedback: v2.feedback, improvedVersion: v2.improvedVersion,
            grammarErrors: v2.grammarErrors, spellingErrors: v2.spellingErrors,
          };
          // Display-friendly WritingGradingResult (kept for existing WritingFullResults UI)
          const disp: WritingGradingResult = {
            partType: p.partType,
            maxPoints: 30,
            addressPercent: 0, bonusPercent: 0, wordPenaltyPercent: 0,
            coherencePenaltyPercent: 0, openingClosingPenalty: 0,
            grammarErrors: v2.grammarErrors as any,
            spellingErrors: v2.spellingErrors as any,
            partScore: v2.rawPart,
            feedback: v2.feedback || "",
            improvedVersion: v2.improvedVersion,
          };
          results.push(disp);
          // Bake AI into snapshot
          try {
            if (p.testResultId) {
              const { mergeSnapshotAI } = await import("@/lib/reviewItemsBuilder");
              await mergeSnapshotAI(p.testResultId, {
                0: {
                  partScore: v2.rawPart,
                  maxPoints: 30,
                  grammarErrors: v2.grammarErrors || [],
                  spellingErrors: v2.spellingErrors || [],
                  feedback: v2.feedback || null,
                },
              }, {
                score: v2.rawPart,
                total: 30,
                scaled50: Math.round((v2.rawPart / 30) * 50),
              });
            }
          } catch (e) { console.warn("[SkillFullPractice v2] bake AI failed", e); }
        } catch (e) {
          console.warn(`[SkillFullPractice v2] gradeWritingPartV2 ${p.partType} failed`, e);
          failedParts += 1;
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

      // Finalize → scale50 + CEFR — ONLY when all 4 writing parts graded.
      // Single-part or partial attempts must NOT produce an official CEFR
      // (raw_total / 120 * 50 collapses to A1 for a lone perfect part).
      const { hasAllFourWritingParts } = await import("@/components/writing/writingGradingV2");
      const allFour = hasAllFourWritingParts(rawParts) && failedParts === 0;
      let scale50 = 0, cefr = "A0", greyZone = false, flagReview = false, rawTotal = 0;
      if (allFour) {
        try {
          const f = await finalizeWriting(rawParts, null, anyForcedComplexity);
          scale50 = f.scale50; cefr = f.cefr; greyZone = f.greyZone; flagReview = f.flagReview; rawTotal = f.rawTotal;
        } catch (e) {
          console.warn("[SkillFullPractice v2] finalizeWriting failed", e);
        }

        // Save aggregate writing_skill_results (linked to last part's test_result)
        const lastPartIdx = orderedIndices[orderedIndices.length - 1];
        const lastSub = writingSubmissionsByPartRef.current[lastPartIdx];
        try {
          await saveWritingSkillResult({
            testResultId: (lastSub as any)?.testResultId ?? null,
            examSetId: (lastSub as any)?.partId ?? null,
            fullTestSessionId: fullPartSessionRef.current,
            parts: partsPayload,
            rawTotal, scale50, cefr, greyZone, flagReview,
          });
        } catch (e) {
          console.warn("[SkillFullPractice v2] saveWritingSkillResult failed", e);
        }

        // Update the LAST test_results row so History reflects scale50/50/cefr.
        try {
          const trid = (lastSub as any)?.testResultId;
          if (trid) {
            await supabase.rpc("finalize_skill_test_result", {
              p_test_result_id: trid,
              p_score: scale50, p_total: 50, p_level: cefr, p_correct_answers: scale50,
            } as any);
          }
        } catch (e) { console.warn("[SkillFullPractice v2] finalize test_results failed", e); }
      } else {
        console.info("[SkillFullPractice v2] Incomplete writing attempt — skipping scale50/CEFR finalize.");
      }


      setWritingResults(results);
      setWritingScore50(scale50);
      setWritingCefr(allFour ? cefr : "");
      setScores({ correct: scale50, total: 50 });
      setWritingPhase("results");
    };


    return (
      <>{adminOverlay}
      <WritingExamEngine
        key={`writing-part-${currentPartIndex}`}
        partType={writingPartType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        externalTimeLeft={writingTimeLeft}
        onTimeTick={(t) => setWritingTimeLeft(t)}
        skipIntro={skipFirstIntro || currentPartIndex > 0}
        fullFlow
        isLastPart={isLastPart}
        onExit={onExit}
        onPartAnswers={handleWritingPartAnswers}
        onComplete={handleWritingPartComplete}
        onPrevious={writingPreviousPart}
        initialAnswers={writingAnswersByPartRef.current[currentPartIndex]}
        onAnswersChange={(a) => { writingAnswersByPartRef.current[currentPartIndex] = a; }}
        enterAtLastQuestion={lastNavDirectionRef.current === "back"}
        allowReveal
        {...writingProps}
      /></>
    );
  }

  return null;
};

export default SkillFullPracticeEngine;
