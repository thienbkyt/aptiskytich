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

// Sheet name → skill + part mapping for full exam import
export interface SheetMapping {
  sheetName: string;
  skill: Skill;
  part: string;
  label: string;
}

export const FULL_EXAM_SHEETS: SheetMapping[] = [
  // Grammar & Vocab
  { sheetName: "GV_Part1", skill: "grammar_vocab", part: "Part 1 - Word Meaning", label: "Grammar Part 1" },
  { sheetName: "GV_Part2", skill: "grammar_vocab", part: "Part 2 - Word Form", label: "Grammar Part 2" },
  { sheetName: "GV_Part3", skill: "grammar_vocab", part: "Part 3 - Sentence Completion", label: "Grammar Part 3" },
  { sheetName: "GV_Part4", skill: "grammar_vocab", part: "Part 4 - Error Identification", label: "Grammar Part 4" },
  // Reading
  { sheetName: "R_Part1", skill: "reading", part: "Part 1 - Sentence Completion", label: "Reading Part 1" },
  { sheetName: "R_Part2", skill: "reading", part: "Part 2 - Text Cohesion", label: "Reading Part 2" },
  { sheetName: "R_Part3", skill: "reading", part: "Part 3 - Opinion Matching", label: "Reading Part 3" },
  { sheetName: "R_Part4", skill: "reading", part: "Part 4 - Long Reading", label: "Reading Part 4" },
  // Listening
  { sheetName: "L_Part1", skill: "listening", part: "Part 1 - Word Recognition", label: "Listening Part 1" },
  { sheetName: "L_Part2", skill: "listening", part: "Part 2 - Matching", label: "Listening Part 2" },
  { sheetName: "L_Part3", skill: "listening", part: "Part 3 - Conversation", label: "Listening Part 3" },
  { sheetName: "L_Part4", skill: "listening", part: "Part 4 - Monologue", label: "Listening Part 4" },
  // Speaking
  { sheetName: "S_Part1", skill: "speaking", part: "Part 1 - Personal", label: "Speaking Part 1" },
  { sheetName: "S_Part2", skill: "speaking", part: "Part 2 - Describe Image", label: "Speaking Part 2" },
  { sheetName: "S_Part3", skill: "speaking", part: "Part 3 - Compare Images", label: "Speaking Part 3" },
  { sheetName: "S_Part4", skill: "speaking", part: "Part 4 - Opinion", label: "Speaking Part 4" },
  // Writing
  { sheetName: "W_Part1", skill: "writing", part: "Part 1 - Short Message", label: "Writing Part 1" },
  { sheetName: "W_Part2", skill: "writing", part: "Part 2 - Social Media", label: "Writing Part 2" },
  { sheetName: "W_Part3", skill: "writing", part: "Part 3 - Questions", label: "Writing Part 3" },
  { sheetName: "W_Part4", skill: "writing", part: "Part 4 - Two Emails", label: "Writing Part 4" },
];
