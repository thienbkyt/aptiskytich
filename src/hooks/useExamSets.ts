import { useState, useEffect } from "react";
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
 * Fetches published exam_sets for a given skill with pagination
 */
export const useExamSets = (skill: string, pageSize = 10) => {
  const [examSets, setExamSets] = useState<ExamSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("exam_sets")
        .select("*", { count: "exact" })
        .eq("skill", skill)
        .eq("is_published", true)
        .order("created_at", { ascending: true })
        .range(from, to);

      if (!error && data) {
        setExamSets(data as unknown as ExamSetRow[]);
      }
      if (count !== null && count !== undefined) {
        setTotalCount(count);
      }
      setLoading(false);
    };
    load();
  }, [skill, page, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return { examSets, loading, page, setPage, totalCount, totalPages };
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
