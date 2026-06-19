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
  initialSection?: number;
  onPageCount?: (n: number) => void;
}

const HistoryReviewRenderer = ({ examSetId, skill, part, testTitle, qResults, onExit, userId, attemptCreatedAt, testResultId, pageBase, pageTotal, initialSection, onPageCount }: Props) => {
  const [rows, setRows] = useState<ExamQuestionRow[] | null>(null);
  const [writingGrading, setWritingGrading] = useState<WritingGradingResult | null | undefined>(undefined);

  useEffect(() => {
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
          if (!cancelled) setRows(all.length ? all : await fetchExamQuestions(examSetId));
          return;
        }
      }
      const r = await fetchExamQuestions(examSetId);
      if (!cancelled) setRows(r);
    })();
    return () => { cancelled = true; };
  }, [examSetId, skill]);

  // Report page count for the current part (drives outer pager).
  useEffect(() => {
    if (!rows || !onPageCount) return;
    if (skill === "grammar") return; // Grammar reports its own count via onGroupCount
    const pt = normalizePart(part);
    let n = 1;
    if (skill === "listening") {
      if (pt === "part1") n = toListeningPart1(rows).length;
      else if (pt === "part4") n = toListeningPart4(rows).length;
    } else if (skill === "reading") {
      if (pt === "part2") {
        const p2 = toReadingPart2(rows) as any;
        n = Array.isArray(p2?.sections) ? p2.sections.length : 1;
      }
    }
    onPageCount(Math.max(1, n));
  }, [rows, skill, part, onPageCount]);

  // Fetch writing AI grading (writing_question_gradings) when applicable.
  useEffect(() => {
    if (skill !== "writing" || !userId) { setWritingGrading(null); return; }
    let cancelled = false;
    (async () => {
      const windowMs = 2 * 60 * 60 * 1000;
      const target = attemptCreatedAt ? new Date(attemptCreatedAt).getTime() : 0;
      let q = supabase.from("writing_question_gradings")
        .select("part,max_points,part_score,grammar_errors,spelling_errors,feedback,created_at,test_result_id")
        .eq("user_id", userId);
      const { data } = await q;
      const partKey = (part || "").toLowerCase().replace(/\s+/g, "");
      const match = ((data || []) as any[]).find((g) => {
        const gp = (g.part || "").toLowerCase().replace(/\s+/g, "");
        if (gp !== partKey) return false;
        if (testResultId && g.test_result_id === testResultId) return true;
        if (!target) return true;
        return Math.abs(new Date(g.created_at).getTime() - target) < windowMs;
      });
      if (cancelled) return;
      if (!match) { setWritingGrading(null); return; }
      setWritingGrading({
        partType: part,
        partScore: match.part_score || 0,
        maxPoints: match.max_points || 0,
        addressPercent: 0,
        bonusPercent: 0,
        wordPenaltyPercent: 0,
        coherencePenaltyPercent: 0,
        openingClosingPenalty: 0,
        grammarErrors: (match.grammar_errors as any) || [],
        spellingErrors: (match.spelling_errors as any) || [],
        feedback: match.feedback || "",
      });
    })();
    return () => { cancelled = true; };
  }, [skill, userId, attemptCreatedAt, testResultId, part]);



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
      partType: pt, testTitle, timeLimit: 1800,
      onExit, reviewMode: true, initialAnswers: init,
      pageBase, pageTotal, initialSection, examSetId,
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
    const props: any = {
      partType: pt, testTitle, timeLimit: 2100,
      onExit, reviewMode: true,
      pageBase, pageTotal, initialQuestion: initialSection,
      examSetId,
    };
    if (pt === "part1") {
      const qs = toListeningPart1(rows);
      props.part1Questions = qs;
      // rows[i].id ↔ position i; map answers in row order
      props.initialAnswers = rows.map((r) => {
        const raw = ansMap[r.id];
        const n = raw != null ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) ? n : null;
      });
    } else {
      // Parts 2/3/4: one row per clip, each user_answer = JSON {partType, answer}
      const fnMap: any = { part2: toListeningPart2, part3: toListeningPart3, part4: toListeningPart4 };
      const propKey = pt === "part2" ? "part2Questions" : pt === "part3" ? "part3Questions" : "part4Questions";
      props[propKey] = fnMap[pt](rows);
      props.initialAnswers = qResults.map((r) => {
        if (!r.user_answer) return null;
        try {
          const p = JSON.parse(r.user_answer);
          return p?.answer ?? null;
        } catch { return null; }
      });
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
