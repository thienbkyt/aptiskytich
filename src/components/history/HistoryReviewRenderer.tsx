import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, normalizePart, type ExamQuestionRow } from "@/hooks/useExamSets";
import {
  toGrammarQuestions,
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
  toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4,
} from "@/lib/examTransformers";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine, { type ReadingPartType } from "@/components/reading/ReadingExamEngine";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import WritingExamEngine, { type WritingPartType } from "@/components/writing/WritingExamEngine";
import type { WritingGradingResult } from "@/hooks/useExamGrading";

interface QResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface Props {
  examSetId: string;
  skill: string;
  part: string;
  testTitle: string;
  qResults: QResult[];
  onExit: () => void;
  userId?: string;
  attemptCreatedAt?: string;
  testResultId?: string;
  pageBase?: number;
  pageTotal?: number;
  /** Reading Part 2 marathon: label prefix like "Đề X/N". */
  pageLabelPrefix?: string;
  initialSection?: number;
  onPageCount?: (n: number) => void;
  /** Optional override for the review timer (defaults to skill-standard). */
  timeLimit?: number;
  /** Marathon review: hide countdown timer in the underlying engine. */
  hideTimer?: boolean;
  /** Marathon review: hide the bottom navigation bar. */
  hideBottomNav?: boolean;
  /** Marathon review: suppress the "← Quay lại kết quả" header button. */
  hideBackToResults?: boolean;
}

// Session-lived cache of resolved question rows keyed by cache-id.
// Non-grammar reviews key on examSetId. Grammar reviews merge sibling
// exam_sets (via full_test_id) so we key on `grammar:${examSetId}` and
// remember the resolved full_test_id → rows mapping too.
const reviewRowsCache = new Map<string, ExamQuestionRow[]>();

const HistoryReviewRenderer = ({ examSetId, skill, part, testTitle, qResults, onExit, userId, attemptCreatedAt, testResultId, pageBase, pageTotal, pageLabelPrefix, initialSection, onPageCount, timeLimit, hideTimer, hideBottomNav, hideBackToResults }: Props) => {
  const cacheKey = skill === "grammar" ? `grammar:${examSetId}` : examSetId;
  const [rows, setRows] = useState<ExamQuestionRow[] | null>(() => reviewRowsCache.get(cacheKey) ?? null);
  const [writingGrading, setWritingGrading] = useState<WritingGradingResult | null | undefined>(undefined);

  useEffect(() => {
    // Fast path: already cached — no network, no spinner.
    const cached = reviewRowsCache.get(cacheKey);
    if (cached) { setRows(cached); return; }

    let cancelled = false;
    (async () => {
      // Grammar & Vocabulary in skill-full-practice merges multiple exam_sets
      // (1 Grammar set + Vocab Part 1..5) sharing the same full_test_id.
      // The single saved test_results row points at only one set, so to
      // restore all 50 questions on review we must fetch every sibling set.
      if (skill === "grammar") {
        const { data: parent } = await supabase
          .from("exam_sets")
          .select("full_test_id")
          .eq("id", examSetId)
          .maybeSingle();
        const fullTestId = (parent as any)?.full_test_id as string | undefined;
        if (fullTestId) {
          const { data: sets } = await supabase
            .from("exam_sets")
            .select("id, part, skill")
            .eq("full_test_id", fullTestId)
            .in("skill", ["grammar_vocab", "grammar", "grammar_vocabulary"])
            .eq("is_published", true);
          const list = (sets || []) as { id: string; part: string }[];
          // Match SkillFullPracticeEngine's ordering exactly.
          list.sort((a, b) => a.part.localeCompare(b.part));
          const all: ExamQuestionRow[] = [];
          for (const s of list) {
            const qs = await fetchExamQuestions(s.id);
            all.push(...qs);
          }
          const resolved = all.length ? all : await fetchExamQuestions(examSetId);
          if (cancelled) return;
          reviewRowsCache.set(cacheKey, resolved);
          setRows(resolved);
          return;
        }
      }
      const r = await fetchExamQuestions(examSetId);
      if (cancelled) return;
      reviewRowsCache.set(cacheKey, r);
      setRows(r);
    })();
    return () => { cancelled = true; };
  }, [cacheKey, examSetId, skill]);

  // Report page count for the current part (drives outer pager).
  useEffect(() => {
    if (!rows || !onPageCount) return;
    if (skill === "grammar") return; // Grammar reports its own count via onGroupCount
    const pt = normalizePart(part);
    let n = 1;
    if (skill === "listening") {
      if (pt === "part1") n = toListeningPart1(rows).length;
      else if (pt === "part2") { const c = toListeningPart2(rows); n = c[0]?.persons?.length || 1; }
      else if (pt === "part3") { const c = toListeningPart3(rows); n = c[0]?.statements?.length || 1; }
      else if (pt === "part4") { const c = toListeningPart4(rows); n = c.reduce((s, x) => s + (x.questions?.length || 0), 0) || c.length; }
    } else if (skill === "reading") {
      if (pt === "part2") {
        const p2 = toReadingPart2(rows) as any;
        n = Array.isArray(p2?.sections) ? p2.sections.length : 1;
      }
    }
    onPageCount(Math.max(1, n));
  }, [rows, skill, part, onPageCount]);

  // Fetch writing AI grading (writing_question_gradings) for this exact attempt via test_result_id.
  useEffect(() => {
    if (skill !== "writing" || !userId) { setWritingGrading(null); return; }
    if (!testResultId) { setWritingGrading(null); return; }
    let cancelled = false;
    (async () => {
      const mm = (part || "").match(/(\d)/); const num = mm ? parseInt(mm[1], 10) : 1;
      const taskKey = `task${num}`;
      const { data: wqg } = await supabase.from("writing_question_gradings")
        .select("part,max_points,part_score,grammar_errors,spelling_errors,feedback")
        .eq("user_id", userId).eq("test_result_id", testResultId);
      const gr = (wqg || []) as any[];
      const partKey = (part || "").toLowerCase().replace(/\s+/g, "");
      const match = gr.find((g) => (g.part || "").toLowerCase().replace(/\s+/g, "") === partKey) || gr[0];
      const { data: trRow } = await supabase.from("test_results").select("full_test_session_id").eq("id", testResultId).maybeSingle();
      const sessionId = (trRow as any)?.full_test_session_id ?? null;
      let q = supabase.from("writing_skill_results").select("parts,created_at").eq("user_id", userId);
      q = sessionId ? q.eq("full_test_session_id", sessionId) : q.eq("test_result_id", testResultId);
      const { data: wsr } = await q.order("created_at", { ascending: false }).limit(1);
      const wsrPart = (wsr as any[])?.[0]?.parts?.[taskKey] ?? null;
      if (cancelled) return;
      if (!match && !wsrPart) { setWritingGrading(null); return; }
      const improvedVersion = wsrPart?.improvedVersion || undefined;
      const upgradeTips = wsrPart?.upgradeTips || undefined;
      if (match) {
        setWritingGrading({
          partType: part, partScore: match.part_score || 0, maxPoints: match.max_points || 0,
          addressPercent: 0, bonusPercent: 0, wordPenaltyPercent: 0, coherencePenaltyPercent: 0, openingClosingPenalty: 0,
          grammarErrors: (match.grammar_errors as any) || (wsrPart?.grammarErrors as any) || [],
          spellingErrors: (match.spelling_errors as any) || (wsrPart?.spellingErrors as any) || [],
          feedback: match.feedback || wsrPart?.feedback || "",
          improvedVersion, upgradeTips,
        } as any);
      } else {
        const raw = Number(wsrPart.rawPart);
        setWritingGrading({
          partType: part, partScore: Number.isFinite(raw) ? Math.min(30, Math.round(raw)) : 0, maxPoints: 30,
          addressPercent: 0, bonusPercent: 0, wordPenaltyPercent: 0, coherencePenaltyPercent: 0, openingClosingPenalty: 0,
          grammarErrors: (wsrPart.grammarErrors as any) || [], spellingErrors: (wsrPart.spellingErrors as any) || [],
          feedback: wsrPart.feedback || "", improvedVersion, upgradeTips,
        } as any);
      }
    })();
    return () => { cancelled = true; };
  }, [skill, userId, testResultId, part]);



  if (!rows) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const partType = normalizePart(part);
  const ansMap: Record<string, string | null> = {};
  qResults.forEach((r) => { ansMap[r.exam_question_id] = r.user_answer; });

  const parseFirstJson = (): any | null => {
    for (const r of qResults) {
      if (!r.user_answer) continue;
      try {
        const p = JSON.parse(r.user_answer);
        if (p && typeof p === "object") return p;
      } catch { /* not json */ }
    }
    return null;
  };

  // ─── GRAMMAR ─────────────────────────────────────────────
  if (skill === "grammar") {
    const questions = toGrammarQuestions(rows);
    const initialAnswers: (number | null)[] = [];
    const initialFill: string[] = [];
    questions.forEach((q) => {
      const eqId = (q.extra_data as any)?._eqId as string | undefined;
      const raw = eqId ? ansMap[eqId] : null;
      if (q.question_type === "fill-in-blank") {
        initialAnswers.push(null);
        initialFill.push(typeof raw === "string" ? raw : "");
      } else {
        let n: number = NaN;
        if (raw != null) {
          const trimmed = String(raw).trim();
          if (/^-?\d+$/.test(trimmed)) {
            n = parseInt(trimmed, 10);
          } else {
            try {
              const p = JSON.parse(trimmed);
              if (typeof p === "number") n = p;
              else if (p && typeof p.answer === "number") n = p.answer;
              else if (p && typeof p.answer === "string" && /^-?\d+$/.test(p.answer)) n = parseInt(p.answer, 10);
            } catch { /* not json */ }
          }
        }
        initialAnswers.push(Number.isFinite(n) ? n : null);
        initialFill.push("");
      }
    });
    return (
      <GrammarExamEngine
        questions={questions}
        testTitle={testTitle}
        timeLimit={1500}
        onExit={onExit}
        reviewMode
        initialAnswers={initialAnswers}
        initialFillAnswers={initialFill}
        showResultsOnSubmit={false}
        initialGroup={initialSection}
        onGroupCount={onPageCount}
      />
    );
  }

  // ─── READING ─────────────────────────────────────────────
  if (skill === "reading") {
    const pt = partType as ReadingPartType;
    const saved = parseFirstJson();
    const init: any = {};
    if (saved?.answers !== undefined) {
      if (pt === "part1") init.p1 = saved.answers;
      else if (pt === "part2") init.p2 = saved.answers;
      else if (pt === "part3") init.p3 = saved.answers;
      else if (pt === "part4") init.p4 = saved.answers;
    }
    const props: any = {
      partType: pt, testTitle, timeLimit: timeLimit ?? 1800,
      onExit, reviewMode: true, initialAnswers: init,
      pageBase, pageTotal, initialSection, examSetId,
      hideTimer, hideBottomNav, hideBackToResults,
    };
    if (pt === "part1") props.part1Question = toReadingPart1(rows);
    if (pt === "part2") props.part2Question = toReadingPart2(rows);
    if (pt === "part3") props.part3Question = toReadingPart3(rows);
    if (pt === "part4") props.part4Question = toReadingPart4(rows);
    return <ReadingExamEngine {...props} />;
  }

  // ─── LISTENING ───────────────────────────────────────────
  if (skill === "listening") {
    const pt = partType as ListeningPartType;
    const props: any = { partType: pt, testTitle, timeLimit: 2100, onExit, reviewMode: true, pageBase, pageTotal, examSetId };
    if (pt === "part1") {
      props.part1Questions = toListeningPart1(rows);
      props.initialAnswers = rows.map((r) => { const raw = ansMap[r.id]; const nn = raw != null ? parseInt(raw, 10) : NaN; return Number.isFinite(nn) ? nn : null; });
      props.initialQuestion = initialSection ?? 0;
    } else {
      const fnMap: any = { part2: toListeningPart2, part3: toListeningPart3, part4: toListeningPart4 };
      const propKey = pt === "part2" ? "part2Questions" : pt === "part3" ? "part3Questions" : "part4Questions";
      const clips = fnMap[pt](rows);
      props[propKey] = clips;
      props.initialAnswers = qResults.map((r) => { if (!r.user_answer) return null; try { const p = JSON.parse(r.user_answer); return p?.answer ?? null; } catch { return null; } });
      const sub = initialSection ?? 0;
      let clipIdx = 0;
      if (pt === "part4") {
        let acc = 0; clipIdx = Math.max(0, clips.length - 1);
        for (let ci = 0; ci < clips.length; ci++) { const size = clips[ci]?.questions?.length ?? 1; if (sub < acc + size) { clipIdx = ci; break; } acc += size; }
      }
      props.initialQuestion = clipIdx;
    }
    return <ListeningExamEngine {...props} />;
  }

  // ─── WRITING ─────────────────────────────────────────────
  if (skill === "writing") {
    // Normalise "Part 1" / "task1" / "Part Two" → task1..task4
    const m = part.match(/(\d)/);
    const num = m ? parseInt(m[1], 10) : 1;
    const taskKey = (`task${num}`) as WritingPartType;
    const raw = qResults[0]?.user_answer || "";
    const init: any = {};
    if (taskKey === "task1") {
      const matches = [...raw.matchAll(/A:\s*([\s\S]*?)(?=\n\nQ\d+:|$)/g)];
      init.shortAnswers = matches.map((mm) => mm[1].trim());
    } else if (taskKey === "task3") {
      const matches = [...raw.matchAll(/A:\s*([\s\S]*?)(?=\n\nQ\d+:|$)/g)];
      init.part3Answers = matches.map((mm) => mm[1].trim());
    } else if (taskKey === "task4") {
      const im = raw.match(/Informal Email:\s*\n?([\s\S]*?)(?=\n\nFormal Email:|$)/);
      const fm = raw.match(/Formal Email:\s*\n?([\s\S]*)$/);
      init.informalAnswer = im?.[1]?.trim() || "";
      init.formalAnswer = fm?.[1]?.trim() || "";
    } else {
      init.textAnswer = raw;
    }
    const props: any = {
      partType: taskKey, testTitle, timeLimit: 3000,
      onExit, reviewMode: true, initialAnswers: init,
      gradingResult: writingGrading ?? null,
    };
    if (taskKey === "task1") props.part1Data = toWritingPart1(rows);
    if (taskKey === "task2") props.part2Data = toWritingPart2(rows);
    if (taskKey === "task3") props.part3Data = toWritingPart3(rows);
    if (taskKey === "task4") props.part4Data = toWritingPart4(rows);
    return <WritingExamEngine {...props} />;
  }

  return null;
};

export default HistoryReviewRenderer;
