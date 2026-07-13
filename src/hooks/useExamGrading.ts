import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GradingResult {
  transcript: string;
  overallLevel: string;
  criteria: { name: string; level: string; feedback: string }[];
  mistakes: { original: string; corrected: string; explanation: string }[];
  suggestions: string[];
}

export interface WritingErrorItem {
  original: string;
  corrected: string;
  explanation: string;
}

export interface WritingGradingResult {
  partType: string;
  maxPoints: number;
  addressPercent: number;
  bonusPercent: number;
  wordPenaltyPercent: number;
  coherencePenaltyPercent: number;
  grammarErrors: WritingErrorItem[];
  spellingErrors: WritingErrorItem[];
  openingClosingPenalty: number;
  partScore: number;
  feedback: string;
  improvedVersion?: string;
  upgradeTips?: string;
}

export type AnyGradingResult = GradingResult | WritingGradingResult;

export function useExamGrading() {
  const [grading, setGrading] = useState<AnyGradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<null | { freeQuota: number; used: number; remaining: number; need?: "pro" | "premium"; tier?: string }>(null);

  const gradeExam = async (params: {
    type: "speaking" | "writing";
    audioBase64?: string;
    text?: string;
    questions: string[];
    partType: string;
    /** When set (writing), grading is additionally persisted to writing_question_gradings linked to this attempt. */
    testResultId?: string | null;
    examSetId?: string | null;
    partLabel?: string;
  }): Promise<AnyGradingResult | null> => {
    // Writing legacy path has been retired — writing V2 (writingGradingV2.ts)
    // is now the only supported writing grading route. It has its own
    // safety-net enqueue on failure.
    if (params.type === "writing") {
      toast.error("Chấm Writing đã chuyển sang phiên bản mới — vui lòng làm lại từ trang đề.");
      return null;
    }

    setIsGrading(true);
    setGrading(null);
    setQuotaExceeded(null);

    try {
      const { data, error } = await supabase.functions.invoke("grade-exam", {
        body: {
          type: params.type,
          audioBase64: params.audioBase64,
          text: params.text,
          questions: params.questions,
          partType: params.partType,
        },
      });


      if (error) {
        // FunctionsHttpError stashes the Response in .context — read its JSON body
        // so quota messages ("Bạn đã đạt giới hạn hôm nay...") reach the user.
        const ctx: any = (error as any)?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) throw new Error(body.error);
          } catch (parseErr: any) {
            if (parseErr?.message && parseErr.message !== (error as any)?.message) throw parseErr;
          }
        }
        throw error;
      }
      if (data?.error === "quota_exceeded") {
        const need: "pro" | "premium" = data.need === "premium" ? "premium" : "pro";
        setQuotaExceeded({
          freeQuota: Number(data.freeQuota ?? 3),
          used: Number(data.used ?? 0),
          remaining: Number(data.remaining ?? 0),
          need,
          tier: data.tier,
        });
        toast.error(
          need === "premium"
            ? `Bạn đã dùng hết lượt chấm AI tháng này. Nâng cấp Premium để chấm không giới hạn.`
            : `Bạn đã dùng hết ${data.freeQuota ?? 3} lượt chấm AI tháng này. Nâng cấp Pro để có thêm lượt.`
        );
        return null;
      }
      if (data?.error) throw new Error(data.error);

      const result = data as AnyGradingResult;
      setGrading(result);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Only speaking legacy remains here — writing V2 has its own path.
        const s = result as GradingResult;
        await supabase.from("exam_gradings").insert({
          user_id: user.id,
          skill: params.type,
          part_type: params.partType,
          overall_level: s.overallLevel,
          criteria: s.criteria as any,
          mistakes: s.mistakes as any,
          suggestions: s.suggestions as any,
          transcript: s.transcript || "",
          student_text: params.text || "",
        });
      }

      return result;
    } catch (e: any) {
      console.error("Grading error:", e);
      const msg = e?.message || "";
      if (/giới hạn hôm nay/i.test(msg)) {
        toast.error(msg);
      } else {
        toast.error("Không thể chấm điểm. Vui lòng thử lại.");
      }
      return null;
    } finally {
      setIsGrading(false);
    }
  };

  return { grading, isGrading, gradeExam, setGrading, quotaExceeded, setQuotaExceeded };
}

// Utility: convert blob URL to base64
export async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
