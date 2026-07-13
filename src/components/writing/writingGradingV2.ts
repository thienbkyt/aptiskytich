import { supabase } from "@/integrations/supabase/client";
import { enqueueGradingFallback } from "@/lib/gradingQueue";

export type WritingBandsV2 = {
  tf: string; // "0".."5" (Part 1: aggregate content-band 0..5)
  gra: string;
  vra: string;
  cc: string;
  reg: string;
};

export type WritingCriteriaAnalysisV2 = Partial<Record<keyof WritingBandsV2, string>>;

export type WritingErrorItemV2 = {
  original: string;
  corrected: string;
  explanation?: string;
  questionIndex?: number;
  emailIndex?: number;
};

export type WritingPartItemV2 = {
  questionText: string;
  userAnswer: string;
  wordCount?: number;
  minReq?: number;
  maxReq?: number;
  tfCap?: number;
  tfContent?: number;
  tfTask?: number;
  flagOver?: boolean;
  improvedVersion?: string;
};

export type WritingPartResultV2 = {
  partType: "task1" | "task2" | "task3" | "task4";
  bands: WritingBandsV2;
  rawPart: number; // 0-30 (already weighted for partType before final aggregation)
  perItem: WritingPartItemV2[];
  analysis: string;
  criteriaAnalysis?: WritingCriteriaAnalysisV2;
  feedback?: string;
  grammarErrors: WritingErrorItemV2[];
  spellingErrors: WritingErrorItemV2[];
  improvedVersion?: string;
  forcedComplexity?: boolean;
};

export type WritingFinalizeResultV2 = {
  rawTotal: number;
  scale50: number;
  cefr: string;
  greyZone: boolean;
  flagReview: boolean;
};

export async function gradeWritingPartV2(
  partType: "task1" | "task2" | "task3" | "task4",
  questions: string[],
  text: string,
  parts?: {
    // For task4 include split emails
    informalText?: string;
    formalText?: string;
    // For task1 the 5 short answers
    shortAnswers?: string[];
    // For task3 three answers
    threeAnswers?: string[];
  }
): Promise<WritingPartResultV2> {
  const gradePayload = {
    type: "writing_v2",
    partType,
    questions,
    text,
    parts,
  };
  const { data, error } = await supabase.functions.invoke("grade-exam", {
    body: gradePayload,
  });
  if (error || !data || (data as any).error) {
    // Safety-net: submission MUST NOT be lost. Enqueue for background retry.
    await enqueueGradingFallback({
      skill: "writing",
      partType,
      payload: gradePayload,
      lastError: (error as any)?.message || (data as any)?.error || "unknown",
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    throw new Error("Empty response from grade-exam (writing_v2)");
  }

  return {
    partType,
    bands: data.bands ?? { tf: "0", gra: "0", vra: "0", cc: "0", reg: "0" },
    rawPart: Number(data.rawPart ?? data.raw_part ?? 0),
    perItem: Array.isArray(data.perItem) ? data.perItem : [],
    analysis: data.analysis ?? "",
    criteriaAnalysis: data.criteriaAnalysis ?? undefined,
    feedback: data.feedback ?? "",
    grammarErrors: Array.isArray(data.grammarErrors) ? data.grammarErrors : [],
    spellingErrors: Array.isArray(data.spellingErrors) ? data.spellingErrors : [],
    improvedVersion: data.improvedVersion ?? "",
    forcedComplexity: !!data.forcedComplexity,
  };
}

/**
 * True only when ALL four writing parts have a graded rawPart (>= 0 number).
 * scale50 / CEFR / writing_skill_results MUST NOT be computed unless this holds:
 * finalize divides by 120 (max across the 4 parts), so a single-part attempt
 * would collapse to A0/A1 which is not a valid CEFR verdict.
 */
export function hasAllFourWritingParts(
  rawParts: { task1?: number; task2?: number; task3?: number; task4?: number }
): boolean {
  const keys: Array<keyof typeof rawParts> = ["task1", "task2", "task3", "task4"];
  return keys.every((k) => typeof rawParts[k] === "number" && !Number.isNaN(rawParts[k] as number));
}

export async function finalizeWriting(
  rawParts: { task1?: number; task2?: number; task3?: number; task4?: number },
  coreGV: string | null = null,
  forcedComplexity: boolean = false
): Promise<WritingFinalizeResultV2> {
  if (!hasAllFourWritingParts(rawParts)) {
    throw new Error(
      "finalizeWriting requires all 4 writing parts (task1..task4); refusing to compute scale50/CEFR from an incomplete attempt."
    );
  }
  const { data, error } = await supabase.functions.invoke("grade-exam", {
    body: {
      type: "writing_finalize",
      rawParts,
      coreGV,
      forcedComplexity,
    },
  });
  if (error) throw error;
  if (!data) throw new Error("Empty response from grade-exam (writing_finalize)");

  return {
    rawTotal: Number(data.rawTotal ?? data.raw_total ?? 0),
    scale50: Number(data.scale50 ?? 0),
    cefr: data.cefr ?? "A0",
    greyZone: !!data.greyZone,
    flagReview: !!data.flagReview,
  };
}

export type SaveWritingSkillResultArgs = {
  testResultId?: string | null;
  examSetId?: string | null;
  fullTestSessionId?: string | null;
  parts: Record<string, Partial<WritingPartResultV2>>;
  rawTotal: number;
  scale50: number;
  cefr: string;
  greyZone: boolean;
  flagReview: boolean;
  feedback?: string;
};

export async function saveWritingSkillResult(
  args: SaveWritingSkillResultArgs
): Promise<{ id: string | null; error: any | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, error: null };
    const { data, error } = await (supabase as any)
      .from("writing_skill_results")
      .insert({
        user_id: user.id,
        test_result_id: args.testResultId ?? null,
        exam_set_id: args.examSetId ?? null,
        full_test_session_id: args.fullTestSessionId ?? null,
        parts: args.parts,
        raw_total: args.rawTotal,
        scale50: args.scale50,
        cefr: args.cefr,
        grey_zone: args.greyZone,
        flag_review: args.flagReview,
        feedback: args.feedback ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[saveWritingSkillResult] insert failed:", error);
      return { id: null, error };
    }
    return { id: data?.id ?? null, error: null };
  } catch (e) {
    console.warn("[saveWritingSkillResult] unexpected error:", e);
    return { id: null, error: e };
  }
}
