import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WrongQuestionSet {
  exam_set_id: string;
  title: string;
  score: number;
  total: number;
  wrong_question_ids: string[];
}

/**
 * Wrong answers from the student's latest standalone attempt of each đề
 * (single-part tabs only — Full Part / Full Test / marathon rows excluded by the RPC).
 */
export const useWrongQuestions = (skill: string, partTab: string) => {
  const { user, loading: authLoading } = useAuth();
  const part = partTab || "";
  const enabled = !authLoading && !!user && !!part && part !== "full";

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["wrongQuestions", skill, part],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<WrongQuestionSet[]> => {
      const { data, error } = await supabase.rpc("get_wrong_questions" as any, {
        p_skill: skill,
        p_part: part,
      } as any);
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []) as any[];
      return rows.map((r) => ({
        exam_set_id: String(r.exam_set_id),
        title: String(r.title ?? ""),
        score: Number(r.score ?? 0),
        total: Number(r.total ?? 0),
        wrong_question_ids: Array.isArray(r.wrong_question_ids) ? r.wrong_question_ids.map(String) : [],
      }));
    },
  });

  const sets = enabled ? (data ?? []) : [];
  const totalWrongQuestions = sets.reduce((s, x) => s + x.wrong_question_ids.length, 0);

  return { sets, totalWrongQuestions, loading: isLoading, refetch };
};
