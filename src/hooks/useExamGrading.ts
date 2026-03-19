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

export function useExamGrading() {
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const gradeExam = async (params: {
    type: "speaking" | "writing";
    audioBase64?: string;
    text?: string;
    questions: string[];
    partType: string;
  }) => {
    setIsGrading(true);
    setGrading(null);

    try {
      const { data, error } = await supabase.functions.invoke("grade-exam", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGrading(data as GradingResult);
      return data as GradingResult;
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
      // Remove "data:audio/webm;base64," prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
