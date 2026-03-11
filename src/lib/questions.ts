import { supabase } from "@/integrations/supabase/client";
import { sampleQuestions, type Question } from "@/data/questions";

export interface DBQuestion {
  id: string;
  skill: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  audio_url?: string | null;
}

const toQuestion = (q: DBQuestion, index: number): Question => ({
  id: index + 1,
  skill: q.skill as Question["skill"],
  question_text: q.question_text,
  options: q.options,
  correct_answer: q.correct_answer,
  explanation: q.explanation,
  audio_url: q.audio_url || null,
});

export const fetchQuestionsBySkill = async (skill: string): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("skill", skill);
  
  if (error || !data || data.length === 0) {
    // Fallback to sample questions
    return sampleQuestions.filter((q) => q.skill === skill);
  }
  return data.map((q, i) => toQuestion({ ...q, options: q.options as unknown as string[] }, i));
};

export const fetchAllQuestions = async (): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*");
  
  if (error || !data || data.length === 0) {
    return sampleQuestions;
  }
  return data.map((q, i) => toQuestion({ ...q, options: q.options as unknown as string[] }, i));
};
