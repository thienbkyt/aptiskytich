import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compareExamItems } from "@/lib/sortExamSets";

const withTimeout = <T,>(p: PromiseLike<T>, ms = 15000): Promise<T> =>
  Promise.race([
    Promise.resolve(p) as Promise<T>,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Tải đề quá lâu (timeout)")), ms)),
  ]);

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
  new_until?: string | null;
  question_count?: number | null;
}

export const NEW_TAG_DAYS = 10;
export const isNewSet = (r: { new_until?: string | null }) =>
  !!r.new_until && new Date(r.new_until).getTime() > Date.now();


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
 * Display label for Reading parts matching the real Aptis exam.
 * Maps internal part1..part4 → "Part 1", "Part 2 + 3", "Part 4", "Part 5".
 */
export const readingPartLabel = (part: string): string => {
  const map: Record<string, string> = {
    part1: "Part 1",
    part2: "Part 2 + 3",
    part3: "Part 4",
    part4: "Part 5",
  };
  return map[normalizePart(part)] ?? part;
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
        .select("id, title, exam_type, skill, part, time_limit, description, is_published, created_at, access_tier, new_until, question_count")
        .eq("skill", skill)
        .eq("is_published", true)
        .order("created_at", { ascending: true });

      if (error || !data) return [];
      const rows = data as unknown as ExamSetRow[];
      rows.sort((a, b) =>
        compareExamItems(
          { title: a.title, access_tier: a.access_tier, isNew: isNewSet(a) },
          { title: b.title, access_tier: b.access_tier, isNew: isNewSet(b) },
        ),
      );
      return rows;
    },
  });

  return { examSets: data ?? [], loading: isLoading };
};

/**
 * Fetch all exam_questions for a given exam_set_id
 */
export const fetchExamQuestions = async (examSetId: string): Promise<ExamQuestionRow[]> => {
  let data: any = null, error: any = null;
  try {
    const res = await withTimeout(
      supabase.from("exam_questions").select("*").eq("exam_set_id", examSetId).order("order_index", { ascending: true }) as any
    );
    data = (res as any).data; error = (res as any).error;
  } catch (e) { error = e; }
  if (error || !data) {
    console.error("[fetchExamQuestions] failed", { examSetId, error });
    return [];
  }
  return data.map((q: any) => ({
    ...q,
    options: (q.options as string[]) || [],
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
