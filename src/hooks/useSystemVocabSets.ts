import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemVocabWord {
  id: string;
  word: string;
  word_type: string;
  phonetic: string;
  meaning: string;
  example_en: string;
  example_vi: string;
  word_family: string[];
  order_index: number;
}

export interface SystemVocabSet {
  id: string;
  group_name: string;
  title: string;
  description: string;
  word_count: number;
  is_published: boolean;
}

export function useSystemVocabSets() {
  return useQuery({
    queryKey: ["system-vocab-sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_vocab_sets")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SystemVocabSet[];
    },
  });
}

export function useSystemVocabWords(setId: string | undefined) {
  return useQuery({
    queryKey: ["system-vocab-words", setId],
    enabled: !!setId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_vocab_words")
        .select("*")
        .eq("vocab_set_id", setId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((w: any) => ({
        ...w,
        word_family: Array.isArray(w.word_family) ? w.word_family : [],
      })) as SystemVocabWord[];
    },
  });
}
