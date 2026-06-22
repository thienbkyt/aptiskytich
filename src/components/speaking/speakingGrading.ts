import { supabase } from "@/integrations/supabase/client";
import type {
  SpeakingPartType,
  SpeakingPart1Data,
  SpeakingPart2Data,
  SpeakingPart3Data,
  SpeakingPart4Data,
} from "@/data/speakingQuestions";

/** AI grading result for one speaking item (Parts 1–3) or aggregated Part 4. */
export interface SpeakingItemGrading {
  transcript: string;
  addressPercent: number;
  grammarErrors: { original: string; corrected: string; explanation: string }[];
  pronunciationErrors: { word: string; note: string }[];
  pictureLogicIssue?: boolean;
  pictureNoAction?: boolean;
  picturePenalty?: number;
  timePenalty: number;
  errorPenalty: number;
  partScore: number;
  maxPoints: number;
  feedback: string;
  /** AI's reasoning for the score (Vietnamese, 2–3 short sentences). */
  analysis?: string;
  improvedVersion?: string;
  itemType?: "question" | "picture";
  // Part 4 aggregated extras
  addressPercents?: number[];
  /** Per sub-question analyses for Part 4. */
  analyses?: string[];
  usedConnectors?: boolean;
  connectorPenalty?: number;
}

const ANALYSIS_DELIM = "<<<ANALYSIS>>>";
const ANALYSIS_END = "<<<END_ANALYSIS>>>";

/** Encode analysis + feedback into a single string for the single `feedback` DB column. */
export function encodeAnalysisFeedback(analysis: string | undefined, feedback: string | undefined): string {
  const a = (analysis ?? "").trim();
  const f = feedback ?? "";
  if (!a) return f;
  return `${ANALYSIS_DELIM}${a}${ANALYSIS_END}${f}`;
}

/** Reverse of encodeAnalysisFeedback. Tolerant to legacy rows without delimiters. */
export function decodeAnalysisFeedback(raw: string | null | undefined): { analysis: string; feedback: string } {
  const s = raw ?? "";
  if (!s.startsWith(ANALYSIS_DELIM)) return { analysis: "", feedback: s };
  const end = s.indexOf(ANALYSIS_END);
  if (end < 0) return { analysis: s.slice(ANALYSIS_DELIM.length), feedback: "" };
  return {
    analysis: s.slice(ANALYSIS_DELIM.length, end),
    feedback: s.slice(end + ANALYSIS_END.length),
  };
}

export type SpeakingGradingResult = SpeakingItemGrading | { error: string };

/** Config describing one grade-exam call (without audio). */
export interface SpeakingGradingSpec {
  partType: SpeakingPartType;
  itemIndex: number;
  questionText: string;
  maxPoints: number;
  itemType: "question" | "picture";
  speakTime: number;
  timePenaltyTiers: [number, number, number];
  questions: string[];          // sent as `questions` to edge function
  subQuestions?: string[];      // Part 4 aggregated
  isAggregated?: boolean;       // true for Part 4 (one call covers whole part)
}

export interface SpeakingPartDataBundle {
  part1Data?: SpeakingPart1Data;
  part2Data?: SpeakingPart2Data;
  part3Data?: SpeakingPart3Data;
  part4Data?: SpeakingPart4Data;
}

/**
 * Build the list of grading specs for a part. Used by both single-part mode
 * (SpeakingExamEngine) and the full-skill flow (SkillFullPracticeEngine) so
 * scoring is guaranteed identical across flows.
 */
export function buildSpeakingGradingSpecs(
  partType: SpeakingPartType,
  data: SpeakingPartDataBundle,
): SpeakingGradingSpec[] {
  if (partType === "part1" && data.part1Data) {
    const st = data.part1Data.speakTime || 30;
    return data.part1Data.questions.map((q, idx) => ({
      partType, itemIndex: idx, questionText: q,
      maxPoints: 2, itemType: "question", speakTime: st,
      timePenaltyTiers: [0.5, 1, 1.5], questions: [q],
    }));
  }
  if (partType === "part2" && data.part2Data) {
    const st = data.part2Data.speakTime || 45;
    const qs = data.part2Data.questions || [];
    return qs.map((q, idx) => idx === 0
      ? { partType, itemIndex: idx, questionText: q, maxPoints: 4, itemType: "picture", speakTime: st, timePenaltyTiers: [1, 2, 3], questions: [q] }
      : { partType, itemIndex: idx, questionText: q, maxPoints: 2, itemType: "question", speakTime: st, timePenaltyTiers: [0.5, 1, 1.5], questions: [q] });
  }
  if (partType === "part3" && data.part3Data) {
    const st = data.part3Data.speakTime || 60;
    const qs = data.part3Data.questions || [];
    return qs.map((q, idx) => idx === 0
      ? { partType, itemIndex: idx, questionText: q, maxPoints: 7, itemType: "picture", speakTime: st, timePenaltyTiers: [2, 3, 4], questions: [q] }
      : { partType, itemIndex: idx, questionText: q, maxPoints: 4, itemType: "question", speakTime: st, timePenaltyTiers: [1, 1.5, 2], questions: [q] });
  }
  if (partType === "part4" && data.part4Data) {
    const st = data.part4Data.speakTime || 120;
    const subQs = data.part4Data.questions || [];
    return [{
      partType, itemIndex: 0, questionText: data.part4Data.topic,
      maxPoints: subQs.length * 7, itemType: "question", speakTime: st,
      timePenaltyTiers: [5, 10, 15], questions: subQs, subQuestions: subQs,
      isAggregated: true,
    }];
  }
  return [];
}

/** Strip the `data:audio/...;base64,` prefix and return the raw base64 body. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Call grade-exam for a single spec. Returns either grading or { error }. */
export async function gradeSpeakingSpec(
  spec: SpeakingGradingSpec,
  audioBase64: string,
  actualSpoken: number,
): Promise<SpeakingGradingResult> {
  const body: Record<string, unknown> = {
    type: "speaking",
    audioBase64,
    questions: spec.questions,
    partType: spec.partType,
    speakTime: spec.speakTime,
    actualSpoken,
    timePenaltyTiers: spec.timePenaltyTiers,
  };
  if (spec.isAggregated) {
    body.subQuestions = spec.subQuestions;
    body.usedConnectorsRequired = true;
  } else {
    body.maxPoints = spec.maxPoints;
    body.itemType = spec.itemType;
  }
  const delays = [1500, 3000];
  let lastErr: any = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("grade-exam", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as SpeakingItemGrading;
    } catch (e: any) {
      lastErr = e;
      console.warn(`[gradeSpeakingSpec] attempt ${attempt + 1} failed`, e?.message ?? e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  console.error("[gradeSpeakingSpec] failed after retries", lastErr);
  return { error: lastErr?.message ?? "Lỗi chấm điểm" };
}

export function computeSpeakingMaxTotal(specs: SpeakingGradingSpec[]): number {
  return specs.reduce((s, x) => s + x.maxPoints, 0);
}

/**
 * Grade many specs in parallel. `blobs[i]` and `actualSpokens[i]` correspond
 * to specs[i]. Missing blobs yield `{ error }` entries. `onItem` (optional)
 * fires as each item completes, useful for incremental UI updates.
 */
export async function gradeSpeakingItems(
  specs: SpeakingGradingSpec[],
  blobs: (Blob | null)[],
  actualSpokens: (number | null | undefined)[],
  onItem?: (idx: number, result: SpeakingGradingResult) => void,
): Promise<SpeakingGradingResult[]> {
  const results: SpeakingGradingResult[] = new Array(specs.length).fill(null) as any;
  await Promise.all(
    specs.map(async (spec, idx) => {
      const blob = blobs[idx];
      if (!blob) {
        const r: SpeakingGradingResult = { error: "Không có bài ghi âm" };
        results[idx] = r;
        onItem?.(idx, r);
        return;
      }
      try {
        const audioBase64 = await blobToBase64(blob);
        const r = await gradeSpeakingSpec(spec, audioBase64, actualSpokens[idx] ?? 0);
        results[idx] = r;
        onItem?.(idx, r);
      } catch (e: any) {
        const r: SpeakingGradingResult = { error: e?.message ?? "Lỗi chấm điểm" };
        results[idx] = r;
        onItem?.(idx, r);
      }
    }),
  );
  return results;
}

/**
 * Persist per-question AI gradings to `speaking_question_gradings`. Best-effort;
 * failures are logged and swallowed. Skips rows with errors.
 */
export async function saveSpeakingGradings(opts: {
  testResultId: string | null;
  examSetId?: string | null;
  partLabel: string;
  gradings: (SpeakingGradingResult | null)[];
  questionTexts: string[];
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows = opts.gradings
      .map((g, i) => {
        if (!g || "error" in g) return null;
        return {
          user_id: user.id,
          test_result_id: opts.testResultId,
          exam_set_id: opts.examSetId ?? null,
          part: opts.partLabel,
          item_index: i,
          question_text: opts.questionTexts[i] ?? null,
          max_points: g.maxPoints ?? 0,
          part_score: g.partScore ?? 0,
          transcript: g.transcript ?? null,
          grammar_errors: (g.grammarErrors ?? []) as any,
          pronunciation_errors: (g.pronunciationErrors ?? []) as any,
          improved_version: g.improvedVersion ?? null,
          feedback: g.feedback ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) {
      await supabase.from("speaking_question_gradings").insert(rows as any);
    }
  } catch (e) {
    console.warn("[saveSpeakingGradings] failed", e);
  }
}
