import { supabase } from "@/integrations/supabase/client";
import { enqueueGradingFallback } from "@/lib/gradingQueue";
import { uploadSpeakingBlobs } from "@/lib/speakingUpload";

export type SpeakingBandsV2 = {
  tf: string;
  gra: string;
  vra: string;
  pro: string;
  fc: string;
};

export type SpeakingCriteriaAnalysisV2 = {
  tf: string;
  gra: string;
  vra: string;
  pro: string;
  fc: string;
};

export type SpeakingPartItemV2 = {
  transcript: string;
  onTopic: boolean;
  questionText?: string;
  improvedVersion?: string;
  upgradeTips?: string;
};

export type SpeakingPartResultV2 = {
  bands: SpeakingBandsV2;
  rawPart: number;
  perItem: SpeakingPartItemV2[];
  analysis: string;
  criteriaAnalysis?: SpeakingCriteriaAnalysisV2;
  feedback?: string;
  improvedVersion: string;
};

export type SpeakingFinalizeResultV2 = {
  rawTotal: number;
  scale50: number;
  cefr: string;
  greyZone: boolean;
  flagReview: boolean;
};

async function blobToBase64Raw(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  // btoa available in browser
  return btoa(binary);
}

export async function gradeSpeakingPartV2(
  partType: string,
  questions: Array<{ questionText?: string; question_text?: string; [k: string]: any }>,
  audioBlobs: Array<Blob | null | undefined>,
  opts?: { sessionId?: string; testResultId?: string | null; examSetId?: string | null; fullTestSessionId?: string | null }
): Promise<SpeakingPartResultV2> {
  const audios: string[] = [];
  for (const b of audioBlobs) {
    if (!b) {
      audios.push("");
      continue;
    }
    try {
      audios.push(await blobToBase64Raw(b));
    } catch {
      audios.push("");
    }
  }

  // Short-circuit: if NO audio was recorded at all, skip the edge call entirely.
  const anySpoken = audios.some((a) => typeof a === "string" && a.length > 100);
  if (!anySpoken) {
    const count = Math.max(questions.length, 1);
    return {
      bands: { tf: "0", gra: "0", vra: "0", pro: "0", fc: "0" },
      rawPart: 0,
      perItem: Array.from({ length: count }, () => ({
        transcript: "",
        onTopic: false,
        improvedVersion: "",
        upgradeTips: "",
        questionText: "",
      })),
      analysis: "Không có bài ghi âm.",
      criteriaAnalysis: { tf: "Không có bài ghi âm.", gra: "Không có bài ghi âm.", vra: "Không có bài ghi âm.", pro: "Không có bài ghi âm.", fc: "Không có bài ghi âm." },
      improvedVersion: "",
    };
  }


  const gradePayload = {
    type: "speaking_v2",
    partType,
    questions,
    audios,
  };

  const { data, error } = await supabase.functions.invoke("grade-exam", {
    body: gradePayload,
  });

  if (error || !data || (data as any).error) {
    // Safety-net: submission MUST NOT be lost. Enqueue for background retry.
    // Upload audio blobs to storage so the queue payload stays small (no base64
    // in jsonb) and the worker can re-download when it retries.
    let audioPaths: Array<string | null> = [];
    try {
      audioPaths = await uploadSpeakingBlobs(
        audioBlobs,
        opts?.sessionId || opts?.testResultId || "adhoc",
        partType
      );
    } catch (e) {
      console.warn("[gradeSpeakingPartV2] audio upload for queue failed:", e);
    }
    const enqueuePayload = {
      type: "speaking_v2",
      partType,
      questions,
      audioPaths, // worker resolves these -> base64 -> passes as `audios`
    };
    await enqueueGradingFallback({
      skill: "speaking",
      partType,
      testResultId: opts?.testResultId ?? null,
      examSetId: opts?.examSetId ?? null,
      fullTestSessionId: opts?.fullTestSessionId ?? null,
      payload: enqueuePayload,
      lastError: (error as any)?.message || (data as any)?.error || "unknown",
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    throw new Error("Empty response from grade-exam (speaking_v2)");
  }

  return {
    bands: data.bands ?? { tf: "", gra: "", vra: "", pro: "", fc: "" },
    rawPart: Number(data.rawPart ?? data.raw_part ?? 0),
    perItem: Array.isArray(data.perItem) ? data.perItem : [],
    analysis: data.analysis ?? "",
    criteriaAnalysis: data.criteriaAnalysis ?? undefined,
    improvedVersion: data.improvedVersion ?? "",
  };
}

export async function finalizeSpeaking(
  rawParts: { part1?: number; part2?: number; part3?: number; part4?: number },
  coreGV: string | null = null
): Promise<SpeakingFinalizeResultV2> {
  const { data, error } = await supabase.functions.invoke("grade-exam", {
    body: {
      type: "speaking_finalize",
      skill: "speaking",
      rawParts,
      coreGV,
    },
  });

  if (error) throw error;
  if (!data) throw new Error("Empty response from grade-exam (speaking_finalize)");

  return {
    rawTotal: Number(data.rawTotal ?? data.raw_total ?? 0),
    scale50: Number(data.scale50 ?? 0),
    cefr: data.cefr ?? "",
    greyZone: !!data.greyZone,
    flagReview: !!data.flagReview,
  };
}

export type SaveSpeakingSkillResultArgs = {
  testResultId?: string | null;
  examSetId?: string | null;
  fullTestSessionId?: string | null;
  parts: Record<
    string,
    {
      bands?: SpeakingBandsV2;
      items?: SpeakingPartItemV2[];
      analysis?: string;
      criteriaAnalysis?: SpeakingCriteriaAnalysisV2;
      feedback?: string;
      improvedVersion?: string;
      rawPart?: number;
    }
  >;
  rawTotal: number;
  scale50: number;
  cefr: string;
  greyZone: boolean;
  flagReview: boolean;
  feedback?: string;
};

export async function saveSpeakingSkillResult(
  args: SaveSpeakingSkillResultArgs
): Promise<{ id: string | null; error: any | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { id: null, error: null };

    const { data, error } = await (supabase as any).rpc("finalize_speaking_skill_result", {
      p_test_result_id: args.testResultId ?? null,
      p_exam_set_id: args.examSetId ?? null,
      p_full_test_session_id: args.fullTestSessionId ?? null,
      p_parts: args.parts,
      p_raw_total: args.rawTotal,
      p_scale50: args.scale50,
      p_cefr: args.cefr,
      p_grey_zone: args.greyZone,
      p_flag_review: args.flagReview,
      p_feedback: args.feedback ?? null,
    });

    if (error) {
      console.warn("[saveSpeakingSkillResult] rpc failed:", error);
      return { id: null, error };
    }
    return { id: (data as string) ?? null, error: null };
  } catch (e) {
    console.warn("[saveSpeakingSkillResult] unexpected error:", e);
    return { id: null, error: e };
  }
}
