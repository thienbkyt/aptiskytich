import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  pageBase?: number;
  pageTotal?: number;
  initialSection?: number;
}

const HistoryReviewRenderer = ({ examSetId, skill, part, testTitle, qResults, onExit, pageBase, pageTotal, initialSection }: Props) => {
  const [rows, setRows] = useState<ExamQuestionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchExamQuestions(examSetId);
      if (!cancelled) setRows(r);
    })();
    return () => { cancelled = true; };
  }, [examSetId]);

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
      const raw = ansMap[(q as any).id];
      if (q.question_type === "fill-in-blank") {
        initialAnswers.push(null);
        initialFill.push(raw || "");
      } else {
        const n = raw != null ? parseInt(raw, 10) : NaN;
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
      props.initialAnswers = rows.map((r) => {
        const raw = ansMap[r.id];
        if (!raw) return null;
        try {
          const p = JSON.parse(raw);
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
