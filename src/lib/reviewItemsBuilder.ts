/**
 * Per-skill builders that flatten engine data + perQuestion + bake-ins
 * (translations / highlights / AI grading) into a flat `items[]` array
 * for `review_snapshot`. The goal: items must be self-sufficient to render
 * a History review without re-fetching the live exam or edge functions.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getSkillBand,
  toScaledScore,
} from "@/data/questions";
import type { ReviewSnapshotItem, ReviewSnapshotAI } from "@/lib/reviewSnapshot";
import {
  part1ItemId,
  part2ItemId,
  part4ItemId,
} from "@/lib/readingReview";
import { l1Id, l2Id, l3Id, l4Id } from "@/lib/listeningReview";

const PERSON_LETTERS = ["A", "B", "C", "D"];

export function computeScaleAndBand(
  skill: string,
  correct: number,
  total: number,
): { scaled50: number | null; band: string | null } {
  if (!total || total <= 0) return { scaled50: null, band: null };
  const scaled50 = toScaledScore(correct, total);
  if (skill === "reading" || skill === "listening" || skill === "writing" || skill === "speaking") {
    return { scaled50, band: getSkillBand(scaled50, skill as any) };
  }
  return { scaled50, band: null };
}

// ---------------- Grammar ----------------
export function buildGrammarItems(
  questions: any[],
  perQuestion: Array<{ user_answer: string | null; is_correct: boolean }> = [],
): ReviewSnapshotItem[] {
  return (questions || []).map((q, i) => {
    const pr = perQuestion[i];
    const userRaw = pr?.user_answer ?? null;
    const isFill = q.question_type === "fill-in-blank";
    const options: string[] | undefined = Array.isArray(q.options) ? q.options : undefined;
    let userAnswer: string | number | null = null;
    if (isFill) {
      userAnswer = userRaw;
    } else if (userRaw !== null && userRaw !== undefined && userRaw !== "") {
      const idx = Number(userRaw);
      userAnswer = Number.isFinite(idx) ? idx : userRaw;
    }
    return {
      questionText: q.question_text ?? q.questionText ?? "",
      options,
      correctAnswer: q.correct_answer ?? q.correct ?? null,
      explanation: q.explanation ?? null,
      userAnswer,
      isCorrect: !!pr?.is_correct,
    };
  });
}

// ---------------- Reading ----------------
function parseReadingAnswers(perQuestion: any[]): any {
  try {
    const raw = perQuestion?.[0]?.user_answer;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.answers ?? null;
  } catch { return null; }
}

export function buildReadingItems(
  partType: "part1" | "part2" | "part3" | "part4",
  engineData: any,
  translations: Record<string, string> = {},
  part3Evidence: Record<string, { person: string; sentence: string }> = {},
  perQuestion: any[] = [],
): ReviewSnapshotItem[] {
  const answers = parseReadingAnswers(perQuestion);
  const items: ReviewSnapshotItem[] = [];

  if (partType === "part1" && engineData?.part1Question) {
    const q = engineData.part1Question;
    (q.gaps || []).forEach((g: any, gi: number) => {
      const userIdx = Array.isArray(answers) ? answers[gi] : null;
      items.push({
        questionText: translations[part1ItemId(gi)] || "",
        options: g.options,
        correctAnswer: g.correct,
        userAnswer: userIdx ?? null,
        isCorrect: userIdx === g.correct,
        explanation: q.explanation ?? null,
        translation: translations[part1ItemId(gi)] || null,
      });
    });
  } else if (partType === "part2" && engineData?.part2Question) {
    const q = engineData.part2Question;
    (q.sections || []).forEach((sec: any, sIdx: number) => {
      (sec.sentences || []).forEach((s: any) => {
        const placements = answers?.[sIdx];
        let userPos: number | null = null;
        if (placements && typeof placements === "object") {
          for (const [pos, txt] of Object.entries(placements)) {
            if (txt === s.text) { userPos = Number(pos); break; }
          }
        }
        items.push({
          questionText: s.text,
          correctAnswer: s.correctPosition,
          userAnswer: userPos,
          isCorrect: userPos === s.correctPosition,
          explanation: q.explanation ?? null,
          translation: translations[part2ItemId(sIdx, s.correctPosition)] || null,
        });
      });
    });
  } else if (partType === "part3" && engineData?.part3Question) {
    const q = engineData.part3Question;
    const peopleNames = (q.people || []).map((p: any, i: number) => p.name ?? PERSON_LETTERS[i] ?? String(i));
    (q.statements || []).forEach((stmt: any, si: number) => {
      const userPerson = answers?.[si] ?? null;
      const evidence = part3Evidence[String(si)];
      items.push({
        questionText: stmt.text,
        options: peopleNames,
        correctAnswer: stmt.correctPerson,
        userAnswer: userPerson,
        isCorrect: userPerson === stmt.correctPerson,
        explanation: q.explanation ?? null,
        translation: evidence ? `${evidence.person}: ${evidence.sentence}` : null,
        extra: evidence ? { evidence } : undefined,
      });
    });
  } else if (partType === "part4" && engineData?.part4Question) {
    const q = engineData.part4Question;
    if (q.paragraphs && q.headings) {
      (q.paragraphs || []).forEach((para: any, pIdx: number) => {
        const correctHeadingIdx = q.headings.findIndex((h: any) => h.paragraphIndex === para.index);
        const userIdx = answers?.[pIdx] ?? null;
        items.push({
          questionText: `Đoạn ${pIdx + 1}: ${(para.text || "").slice(0, 120)}…`,
          options: q.headings.map((h: any) => h.text),
          correctAnswer: correctHeadingIdx,
          userAnswer: userIdx,
          isCorrect: userIdx === correctHeadingIdx,
          explanation: q.explanation ?? null,
          translation: translations[part4ItemId(correctHeadingIdx)] || null,
        });
      });
    } else if (q.questions) {
      (q.questions || []).forEach((qq: any, qi: number) => {
        const userIdx = answers?.[qi] ?? null;
        items.push({
          questionText: qq.text,
          options: qq.options,
          correctAnswer: qq.correct,
          userAnswer: userIdx,
          isCorrect: userIdx === qq.correct,
          explanation: q.explanation ?? null,
        });
      });
    }
  }

  return items;
}

// ---------------- Listening ----------------
function parseListeningGroupAnswer(raw: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw)?.answer ?? null; } catch { return null; }
}

export function buildListeningItems(
  partType: "part1" | "part2" | "part3" | "part4",
  engineData: any,
  highlights: Record<string, string> = {},
  perQuestion: any[] = [],
): ReviewSnapshotItem[] {
  const items: ReviewSnapshotItem[] = [];

  if (partType === "part1" && engineData?.part1Questions) {
    engineData.part1Questions.forEach((q: any, qi: number) => {
      const pr = perQuestion[qi];
      const userIdx = pr?.user_answer != null ? Number(pr.user_answer) : null;
      items.push({
        questionText: q.questionText || "Which word do you hear?",
        options: q.options,
        correctAnswer: q.correct,
        userAnswer: userIdx,
        isCorrect: userIdx === q.correct,
        highlight: highlights[l1Id(qi)] || null,
      });
    });
  } else if (partType === "part2" && engineData?.part2Questions) {
    const q = engineData.part2Questions[0];
    if (q) {
      const groupAns = parseListeningGroupAnswer(perQuestion?.[0]?.user_answer) || {};
      (q.persons || []).forEach((p: any) => {
        const correctInfo = (q.infoItems || []).find((it: any) => it.correctPerson === p.name);
        const userText = groupAns[p.name] ?? null;
        items.push({
          questionText: `Speaker ${p.name}`,
          options: (q.infoItems || []).map((it: any) => it.text),
          correctAnswer: correctInfo?.text ?? null,
          userAnswer: userText,
          isCorrect: !!correctInfo && userText === correctInfo.text,
          highlight: highlights[l2Id(p.name)] || null,
        });
      });
    }
  } else if (partType === "part3" && engineData?.part3Questions) {
    const q = engineData.part3Questions[0];
    if (q) {
      const groupAns = parseListeningGroupAnswer(perQuestion?.[0]?.user_answer) || {};
      (q.statements || []).forEach((s: any, si: number) => {
        const userVal = groupAns[si] ?? null;
        items.push({
          questionText: s.text,
          options: ["man", "woman", "both"],
          correctAnswer: s.correctAnswer,
          userAnswer: userVal,
          isCorrect: userVal === s.correctAnswer,
          highlight: highlights[l3Id(si)] || null,
        });
      });
    }
  } else if (partType === "part4" && engineData?.part4Questions) {
    engineData.part4Questions.forEach((clip: any, ci: number) => {
      const groupAns = parseListeningGroupAnswer(perQuestion?.[ci]?.user_answer) || {};
      (clip.questions || []).forEach((qq: any, qi: number) => {
        const userIdx = groupAns[qi] ?? null;
        items.push({
          questionText: qq.text,
          options: qq.options,
          correctAnswer: qq.correct,
          userAnswer: userIdx,
          isCorrect: userIdx === qq.correct,
          highlight: highlights[l4Id(ci, qi)] || null,
        });
      });
    });
  }

  return items;
}

// ---------------- Writing ----------------
export interface WritingItemSpec {
  questionText: string;
  userText: string;
  /** Optional AI payload to bake in. */
  ai?: ReviewSnapshotAI | null;
}

export function buildWritingItems(specs: WritingItemSpec[]): ReviewSnapshotItem[] {
  return specs.map((s) => ({
    questionText: s.questionText,
    userAnswer: s.userText ?? "",
    isCorrect: false,
    ai: s.ai ?? null,
  }));
}

export function writingSpecsFromEngine(
  partType: string,
  engineData: any,
  texts: {
    shortAnswers?: string[];
    textAnswer?: string;
    part3Answers?: string[];
    informalAnswer?: string;
    formalAnswer?: string;
  },
): WritingItemSpec[] {
  if (partType === "task1" || partType === "part1") {
    const qs = engineData?.part1Data?.questions || [];
    return qs.map((q: any, i: number) => ({
      questionText: q.text,
      userText: texts.shortAnswers?.[i] ?? "",
    }));
  }
  if (partType === "task2" || partType === "part2") {
    return [{
      questionText: engineData?.part2Data?.question || "",
      userText: texts.textAnswer ?? "",
    }];
  }
  if (partType === "task3" || partType === "part3") {
    const qs = engineData?.part3Data?.questions || [];
    return qs.map((q: any, i: number) => ({
      questionText: q.text,
      userText: texts.part3Answers?.[i] ?? "",
    }));
  }
  if (partType === "task4" || partType === "part4") {
    const d = engineData?.part4Data;
    return [
      { questionText: d?.informalEmail?.instruction || "Informal email", userText: texts.informalAnswer ?? "" },
      { questionText: d?.formalEmail?.instruction || "Formal email", userText: texts.formalAnswer ?? "" },
    ];
  }
  return [];
}

// ---------------- Speaking ----------------
export interface SpeakingItemSpec {
  questionText: string;
  recordingPath?: string | null;
  ai?: ReviewSnapshotAI | null;
}

export function buildSpeakingItems(specs: SpeakingItemSpec[]): ReviewSnapshotItem[] {
  return specs.map((s) => ({
    questionText: s.questionText,
    userAnswer: s.recordingPath ? "(recorded)" : null,
    isCorrect: false,
    ai: {
      ...(s.ai || {}),
      recordingPath: s.recordingPath ?? s.ai?.recordingPath ?? null,
    },
  }));
}

export function speakingQuestionsFromPart(
  partType: "part1" | "part2" | "part3" | "part4",
  partData: { part1Data?: any; part2Data?: any; part3Data?: any; part4Data?: any },
): string[] {
  if (partType === "part1") return partData.part1Data?.questions || [];
  if (partType === "part2") return partData.part2Data?.questions || [];
  if (partType === "part3") return partData.part3Data?.questions || [];
  if (partType === "part4") return partData.part4Data?.questions || [];
  return [];
}

// ---------------- Post-grade snapshot update ----------------
/**
 * Merge per-item AI payloads into an existing `review_snapshot`. Used after
 * Writing/Speaking grading completes (which is async, after the row is saved).
 * Best-effort: any failure is swallowed.
 */
export async function mergeSnapshotAI(
  testResultId: string | null | undefined,
  aiByIndex: Record<number, ReviewSnapshotAI>,
  extra?: { score?: number; total?: number; band?: string | null; scaled50?: number | null },
): Promise<void> {
  if (!testResultId) return;
  try {
    const { data, error } = await supabase
      .from("test_results")
      .select("review_snapshot")
      .eq("id", testResultId)
      .maybeSingle();
    if (error || !data) return;
    const snap: any = (data as any).review_snapshot;
    if (!snap || !Array.isArray(snap.items)) return;
    const nextItems = snap.items.map((it: any, idx: number) => {
      const ai = aiByIndex[idx];
      if (!ai) return it;
      return { ...it, ai: { ...(it.ai || {}), ...ai } };
    });
    const updated = {
      ...snap,
      items: nextItems,
      ...(extra || {}),
    };
    await supabase
      .from("test_results")
      .update({ review_snapshot: updated as any })
      .eq("id", testResultId);
  } catch (e) {
    console.warn("[mergeSnapshotAI] skipped", e);
  }
}
