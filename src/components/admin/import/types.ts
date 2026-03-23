export type ExamType = "general" | "advanced";
export type Skill = "grammar_vocab" | "reading" | "listening" | "speaking" | "writing";
export type ImportMethod = "form" | "excel" | "ai";

export const SKILL_LABELS: Record<Skill, string> = {
  grammar_vocab: "Grammar & Vocab",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export const SKILL_PARTS: Record<Skill, string[]> = {
  grammar_vocab: ["Part 1 - Word Meaning", "Part 2 - Word Form", "Part 3 - Sentence Completion", "Part 4 - Error Identification"],
  reading: ["Part 1 - Sentence Completion", "Part 2 - Text Cohesion", "Part 3 - Opinion Matching", "Part 4 - Long Reading"],
  listening: ["Part 1 - Word Recognition", "Part 2 - Matching", "Part 3 - Conversation", "Part 4 - Monologue"],
  speaking: ["Part 1 - Personal", "Part 2 - Describe Image", "Part 3 - Compare Images", "Part 4 - Opinion"],
  writing: ["Part 1 - Short Message", "Part 2 - Social Media", "Part 3 - Questions", "Part 4 - Two Emails"],
};

export interface ExamSetRow {
  id: string;
  title: string;
  exam_type: string;
  skill: string;
  part: string;
  time_limit: number;
  description: string;
  is_published: boolean;
  created_at: string;
}

export interface ExamQuestionRow {
  id?: string;
  exam_set_id: string;
  order_index: number;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  audio_url: string | null;
  image_url: string | null;
  response_time: number | null;
  extra_data: Record<string, any>;
}

export interface ExcelImportRow {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  audio_filename?: string;
  image_url?: string;
  response_time?: number;
  order_index?: number;
}
