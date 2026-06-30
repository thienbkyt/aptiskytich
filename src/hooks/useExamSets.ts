import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExamSetRow {
  id: string;
  title: string;
  exam_type: string;
  skill: string;
  part: string;
  time_limit: number;
  description: string | null;
  is_published: boolean;
  created_at: string;
  access_tier?: "free" | "pro" | "premium";
}

export interface ExamQuestionRow {
  id: string;
  exam_set_id: string;
  order_index: number;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: number | null;
  explanation: string | null;
  audio_url: string | null;
  image_url: string | null;
  response_time: number | null;
  extra_data: Record<string, any> | null;
}

/**
 * Normalize part strings like "Part 1 - Sentence Completion" → "part1"
 */
export const normalizePart = (part: string): string => {
  const match = part.match(/part\s*(\d)/i);
  if (match) return `part${match[1]}`;
  return part.toLowerCase().replace(/\s+/g, "");
};

/**
 * Fetches published exam_sets for a given skill
 */
export const useExamSets = (skill: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ["examSets", skill],
    queryFn: async (): Promise<ExamSetRow[]> => {
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, title, exam_type, skill, part, time_limit, description, is_published, created_at, access_tier")
        .eq("skill", skill)
        .eq("is_published", true)
        .order("created_at", { ascending: true });

      if (error || !data) return [];
      const rows = data as unknown as ExamSetRow[];
      const numOf = (t: string) => {
        const m = t.match(/\d+/);
        return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
      };
      rows.sort((a, b) => {
        const na = numOf(a.title), nb = numOf(b.title);
        if (na !== nb) return na - nb;
        return a.title.localeCompare(b.title);
      });
      return rows;
    },
  });

  return { examSets: data ?? [], loading: isLoading };
};

/**
 * Fetch all exam_questions for a given exam_set_id
 */
export const fetchExamQuestions = async (examSetId: string): Promise<ExamQuestionRow[]> => {
  const { data, error } = await supabase
    .from("exam_questions")
    .select("*")
    .eq("exam_set_id", examSetId)
    .order("order_index", { ascending: true });

  if (error || !data) return [];
  return data.map((q) => ({
    ...q,
    options: (q.options as unknown as string[]) || [],
    extra_data: (q.extra_data as Record<string, any>) || {},
  })) as ExamQuestionRow[];
};

/**
 * Fetch question count per exam set (for card display)
 */
export const fetchExamSetQuestionCount = async (examSetId: string): Promise<number> => {
  const { count, error } = await supabase
    .from("exam_questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_set_id", examSetId);

  if (error || count === null) return 0;
  return count;
};
