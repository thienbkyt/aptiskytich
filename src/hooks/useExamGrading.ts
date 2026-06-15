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
}

export type AnyGradingResult = GradingResult | WritingGradingResult;

export function useExamGrading() {
  const [grading, setGrading] = useState<AnyGradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const gradeExam = async (params: {
    type: "speaking" | "writing";
    audioBase64?: string;
    text?: string;
    questions: string[];
    partType: string;
  }): Promise<AnyGradingResult | null> => {
    setIsGrading(true);
    setGrading(null);

    try {
      const { data, error } = await supabase.functions.invoke("grade-exam", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data as AnyGradingResult;
      setGrading(result);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (params.type === "writing") {
          const w = result as WritingGradingResult;
          const mistakes = [
            ...(w.grammarErrors || []).map((e) => ({ ...e, kind: "grammar" })),
            ...(w.spellingErrors || []).map((e) => ({ ...e, kind: "spelling" })),
          ];
          await supabase.from("exam_gradings").insert({
            user_id: user.id,
            skill: params.type,
            part_type: params.partType,
            overall_level: `${w.partScore}/${w.maxPoints}`,
            criteria: {
              addressPercent: w.addressPercent,
              bonusPercent: w.bonusPercent,
              wordPenaltyPercent: w.wordPenaltyPercent,
              coherencePenaltyPercent: w.coherencePenaltyPercent,
              openingClosingPenalty: w.openingClosingPenalty,
              partScore: w.partScore,
              maxPoints: w.maxPoints,
            } as any,
            mistakes: mistakes as any,
            suggestions: [w.feedback] as any,
            transcript: "",
            student_text: params.text || "",
          });
        } else {
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
      }

      return result;
    } catch (e: any) {
      console.error("Grading error:", e);
      toast.error("Không thể chấm điểm. Vui lòng thử lại.");
      return null;
    } finally {
      setIsGrading(false);
    }
  };

  return { grading, isGrading, gradeExam, setGrading };
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
