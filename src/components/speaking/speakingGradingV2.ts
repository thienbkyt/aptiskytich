import { supabase } from "@/integrations/supabase/client";

export type SpeakingBandsV2 = {
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
};

export type SpeakingPartResultV2 = {
  bands: SpeakingBandsV2;
  rawPart: number;
  perItem: SpeakingPartItemV2[];
  analysis: string;
  feedback: string;
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
  audioBlobs: Array<Blob | null | undefined>
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

  const { data, error } = await supabase.functions.invoke("grade-exam", {
    body: {
      type: "speaking_v2",
      partType,
      questions,
      audios,
    },
  });

  if (error) throw error;
  if (!data) throw new Error("Empty response from grade-exam (speaking_v2)");

  return {
    bands: data.bands ?? { tf: "", gra: "", vra: "", pro: "", fc: "" },
    rawPart: Number(data.rawPart ?? 0),
    perItem: Array.isArray(data.perItem) ? data.perItem : [],
    analysis: data.analysis ?? "",
    feedback: data.feedback ?? "",
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
    rawTotal: Number(data.rawTotal ?? 0),
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

    const payload: any = {
      user_id: user.id,
      test_result_id: args.testResultId ?? null,
      exam_set_id: args.examSetId ?? null,
      full_test_session_id: args.fullTestSessionId ?? null,
      parts: args.parts,
      raw_total: args.rawTotal,
      scale_50: args.scale50,
      cefr: args.cefr,
      grey_zone: args.greyZone,
      flag_review: args.flagReview,
      feedback: args.feedback ?? null,
    };

    const { data, error } = await (supabase as any)
      .from("speaking_skill_results")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[saveSpeakingSkillResult] insert failed:", error);
      return { id: null, error };
    }
    return { id: data?.id ?? null, error: null };
  } catch (e) {
    console.warn("[saveSpeakingSkillResult] unexpected error:", e);
    return { id: null, error: e };
  }
}
