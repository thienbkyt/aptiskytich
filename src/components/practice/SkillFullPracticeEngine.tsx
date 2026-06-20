import { useState, useEffect, useCallback, useRef } from "react";
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
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import ReadingFullResults, { type ReadingFullPartResult } from "@/components/reading/ReadingFullResults";
import ListeningFullResults, { type ListeningFullPartResult } from "@/components/listening/ListeningFullResults";
import WritingFullResults from "@/components/writing/WritingFullResults";
import { useExamGrading, type WritingGradingResult } from "@/hooks/useExamGrading";
import { saveExamResult, saveSpeakingRecording } from "@/lib/saveExamResult";

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
}

type FlowPhase = "loading" | "exam" | "completed";

const SkillFullPracticeEngine = ({ fullTestId, skill, testTitle, onExit }: SkillFullPracticeEngineProps) => {
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
  const { gradeExam } = useExamGrading();

  // Speaking full-practice grading state
  const speakingSubmissionsByPartRef = useRef<Record<number, SpeakingPartSubmission>>({});
  const speakingTestResultIdByPartRef = useRef<Record<number, string | null>>({});
  const speakingGradingPromisesByPartRef = useRef<
    Record<number, Promise<Awaited<ReturnType<typeof gradeSpeakingSpec>>[]>>
  >({});
  const [speakingPhase, setSpeakingPhase] = useState<"none" | "grading" | "results">("none");
  const [speakingGradedCount, setSpeakingGradedCount] = useState(0);
  const [speakingGradeTotal, setSpeakingGradeTotal] = useState(0);
  const [speakingFullParts, setSpeakingFullParts] = useState<SpeakingFullPartResult[]>([]);
  const [speakingTotalScore, setSpeakingTotalScore] = useState(0);
  const [speakingTotalMax, setSpeakingTotalMax] = useState(0);


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
        <SpeakingFullResults
          parts={speakingFullParts}
          totalScore={speakingTotalScore}
          totalMax={speakingTotalMax}
          onExit={onExit}
        />
      );
    }
    if (speakingPhase === "grading") {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Chờ chút nhé. AI Kỳ Tích đang chấm điểm cho bạn, đừng thoát hay đổi tab nha.
          </p>
          {speakingGradeTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              ({speakingGradedCount}/{speakingGradeTotal})
            </p>
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
      });
      speakingTestResultIdByPartRef.current[currentPartIndex] = _trId ?? null;

      // Kick background grading for THIS part now, so it overlaps the next part.
      const subNow = speakingSubmissionsByPartRef.current[currentPartIndex];
      if (subNow) {
        setSpeakingGradeTotal((t) => t + subNow.items.length);
        // Allow overwrite (e.g. if user re-completed this part after going back)
        speakingGradingPromisesByPartRef.current[currentPartIndex] = gradePartItems(subNow);
      }

      if (!isLastPart) {
        lastNavDirectionRef.current = "forward";
        setCurrentPartIndex((p) => p + 1);
        return;
      }

      // Last part → await every per-part grading promise (most already done).
      setSpeakingPhase("grading");

      const orderedIndices = Object.keys(speakingSubmissionsByPartRef.current)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b);
      const orderedSubs = orderedIndices
        .map((i) => speakingSubmissionsByPartRef.current[i])
        .filter(Boolean) as SpeakingPartSubmission[];

      const gradingsByPart: Awaited<ReturnType<typeof gradeSpeakingSpec>>[][] = [];
      for (const partIdx of orderedIndices) {
        const p = speakingGradingPromisesByPartRef.current[partIdx];
        gradingsByPart.push(p ? await p : []);
      }

      const partResults: SpeakingFullPartResult[] = [];
      let runningScore = 0;
      let runningMax = 0;

      for (let oi = 0; oi < orderedSubs.length; oi++) {
        const sub = orderedSubs[oi];
        const originalPartIdx = orderedIndices[oi];
        const originalPart = parts[originalPartIdx];
        const gradings = gradingsByPart[oi];
        for (const r of gradings) {
          if (r && !("error" in r)) runningScore += r.partScore || 0;
        }
        const maxTotal = sub.items.reduce((s, i) => s + i.spec.maxPoints, 0);
        runningMax += maxTotal;
        const entry: SpeakingFullPartResult = {
          partType: sub.partType,
          partNumber: sub.partNumber,
          prompts: sub.items.map((i) => i.spec.questionText),
          recordingUrls: sub.items.map((i) => i.audioUrl),
          gradings,
          maxTotal,
        };
        if (originalPart) {
          if (sub.partType === "part1") entry.part1Data = toSpeakingPart1(originalPart.questions);
          else if (sub.partType === "part2") entry.part2Data = toSpeakingPart2(originalPart.questions);
          else if (sub.partType === "part3") entry.part3Data = toSpeakingPart3(originalPart.questions);
          else if (sub.partType === "part4") entry.part4Data = toSpeakingPart4(originalPart.questions);
        }
        partResults.push(entry);

        if (originalPart) {
          const pathByIdx: Record<number, string> = {};
          await Promise.all(sub.items.map(async (item, idx) => {
            if (!item.blob) return;
            try {
              const path = await saveSpeakingRecording({
                examSetId: originalPart.id,
                part: `${originalPart.partNorm}_q${idx + 1}`,
                blob: item.blob,
                durationSeconds: item.actualSpoken,
                testResultId: speakingTestResultIdByPartRef.current[originalPartIdx] ?? null,
              });
              if (path) pathByIdx[idx] = path;
            } catch (e) {
              console.warn("[SkillFullPractice] saveSpeakingRecording failed", e);
            }
          }));

          try {
            await saveSpeakingGradings({
              testResultId: speakingTestResultIdByPartRef.current[originalPartIdx] ?? null,
              examSetId: originalPart.id,
              partLabel: `Part ${sub.partNumber}`,
              gradings,
              questionTexts: sub.items.map((i) => i.spec.questionText),
            });
          } catch (e) {
            console.warn("[SkillFullPractice] saveSpeakingGradings failed", e);
          }

          // Bake AI + recordingPaths into this part's snapshot.
          try {
            const trid = speakingTestResultIdByPartRef.current[originalPartIdx] ?? null;
            if (trid) {
              const { mergeSnapshotAI } = await import("@/lib/reviewItemsBuilder");
              const aiByIndex: Record<number, any> = {};
              let partScore = 0, partMax = 0;
              gradings.forEach((g, i) => {
                if (!g || (g as any).error) return;
                const gg = g as any;
                aiByIndex[i] = {
                  partScore: gg.partScore,
                  maxPoints: gg.maxPoints,
                  grammarErrors: gg.grammarErrors || [],
                  pronunciationErrors: gg.pronunciationErrors || [],
                  feedback: gg.feedback || null,
                  transcript: gg.transcript || null,
                  improvedVersion: gg.improvedVersion || null,
                  recordingPath: pathByIdx[i] ?? null,
                };
                partScore += gg.partScore || 0;
                partMax += gg.maxPoints || 0;
              });
              // also include pure-recording rows with no AI
              Object.entries(pathByIdx).forEach(([k, p]) => {
                const i = Number(k);
                if (!aiByIndex[i]) aiByIndex[i] = { recordingPath: p };
              });
              const scaled = partMax > 0 ? Math.round((partScore / partMax) * 50) : null;
              await mergeSnapshotAI(trid, aiByIndex, partMax > 0 ? {
                score: partScore, total: partMax, scaled50: scaled,
              } : undefined);
            }
          } catch (e) { console.warn("[SkillFullPractice] mergeSnapshotAI failed", e); }
        }
      }

      setSpeakingFullParts(partResults);
      setSpeakingTotalScore(runningScore);
      setSpeakingTotalMax(runningMax);
      setSpeakingPhase("results");
      setScores({ correct: Math.round(runningScore), total: Math.round(runningMax) });
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
        skipIntro={currentPartIndex > 0}
        onAdminPrevious={handleAdminPreviousPart}
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
        skipIntro={currentPartIndex > 0}
        fullFlow
        onExit={onExit}
        onComplete={(correct, total, perQuestion) => handlePartComplete(correct, total, perQuestion)}
        onPreviousPart={handleAdminPreviousPart}
        showResultsOnSubmit={false}
        initialAnswers={listeningAnswersByPartRef.current[currentPartIndex]}
        onAnswersChange={(a) => { listeningAnswersByPartRef.current[currentPartIndex] = a; }}
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
        skipIntro={currentPartIndex > 0}
        fullFlow
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

      // Last part → grade all sequentially using latest submission per part index
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
      for (let i = 0; i < orderedSubmissions.length; i++) {
        const p = orderedSubmissions[i];
        const res = await gradeExam({
          type: "writing",
          text: p.text,
          questions: p.questions,
          partType: p.partType,
          testResultId: p.testResultId ?? null,
          examSetId: p.partId ?? null,
          partLabel: WRITING_PART_LABELS[p.partType] ?? p.partType,
        });
        if (res) results.push(res as WritingGradingResult);
        setWritingGradedCount(i + 1);
      }
      const total100 = results.reduce((s, r) => s + (r.partScore || 0), 0);
      setWritingResults(results);
      setWritingScore50(Math.round(total100 / 2));
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
        skipIntro={currentPartIndex > 0}
        fullFlow
        isLastPart={isLastPart}
        onExit={onExit}
        onPartAnswers={handleWritingPartAnswers}
        onComplete={handleWritingPartComplete}
        onPrevious={writingPreviousPart}
        initialAnswers={writingAnswersByPartRef.current[currentPartIndex]}
        onAnswersChange={(a) => { writingAnswersByPartRef.current[currentPartIndex] = a; }}
        enterAtLastQuestion={lastNavDirectionRef.current === "back"}
        {...writingProps}
      /></>
    );
  }

  return null;
};

export default SkillFullPracticeEngine;
