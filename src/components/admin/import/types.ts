export type ExamType = "general" | "advanced";
export type Skill = "grammar_vocab" | "reading" | "listening" | "speaking" | "writing";
export type ImportMethod = "form" | "excel" | "ai";

export const SKILL_LABELS: Record<Skill, string> = {
  grammar_vocab: "Core (Grammar & Vocab)",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export const SKILL_PARTS: Record<Skill, string[]> = {
  grammar_vocab: ["Part 1 - Grammar", "Part 2 - Vocabulary"],
  reading: ["Part 1 - Sentence Comprehension", "Part 2 - Text Cohesion", "Part 3 - Opinion Matching", "Part 4 - Long Text Comprehension"],
  listening: ["Part 1 - Information Recognition", "Part 2 - Information Matching", "Part 3 - Opinion Matching", "Part 4 - Monologue Comprehension"],
  speaking: ["Part 1 - Personal Information", "Part 2 - Describe & Opinion", "Part 3 - Compare & Explain", "Part 4 - Abstract Discussion"],
  writing: ["Part 1 - Word-level Writing", "Part 2 - Short Text Writing", "Part 3 - Three Responses", "Part 4 - Formal & Informal Emails"],
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
  // Core (Grammar & Vocabulary) — 25 min
  { sheetName: "Core_Grammar", skill: "grammar_vocab", part: "Part 1 - Grammar", label: "Core Grammar" },
  { sheetName: "Core_Vocab", skill: "grammar_vocab", part: "Part 2 - Vocabulary", label: "Core Vocabulary" },
  // Reading — 35 min
  { sheetName: "R_Part1", skill: "reading", part: "Part 1 - Sentence Comprehension", label: "Reading Part 1" },
  { sheetName: "R_Part2", skill: "reading", part: "Part 2 - Text Cohesion", label: "Reading Part 2" },
  { sheetName: "R_Part3", skill: "reading", part: "Part 3 - Opinion Matching", label: "Reading Part 3" },
  { sheetName: "R_Part4", skill: "reading", part: "Part 4 - Long Text Comprehension", label: "Reading Part 4" },
  // Listening — 40 min
  { sheetName: "L_Part1", skill: "listening", part: "Part 1 - Information Recognition", label: "Listening Part 1" },
  { sheetName: "L_Part2", skill: "listening", part: "Part 2 - Information Matching", label: "Listening Part 2" },
  { sheetName: "L_Part3", skill: "listening", part: "Part 3 - Opinion Matching", label: "Listening Part 3" },
  { sheetName: "L_Part4", skill: "listening", part: "Part 4 - Monologue Comprehension", label: "Listening Part 4" },
  // Speaking — 12 min
  { sheetName: "S_Part1", skill: "speaking", part: "Part 1 - Personal Information", label: "Speaking Part 1" },
  { sheetName: "S_Part2", skill: "speaking", part: "Part 2 - Describe & Opinion", label: "Speaking Part 2" },
  { sheetName: "S_Part3", skill: "speaking", part: "Part 3 - Compare & Explain", label: "Speaking Part 3" },
  { sheetName: "S_Part4", skill: "speaking", part: "Part 4 - Abstract Discussion", label: "Speaking Part 4" },
  // Writing — 50 min
  { sheetName: "W_Part1", skill: "writing", part: "Part 1 - Word-level Writing", label: "Writing Part 1" },
  { sheetName: "W_Part2", skill: "writing", part: "Part 2 - Short Text Writing", label: "Writing Part 2" },
  { sheetName: "W_Part3", skill: "writing", part: "Part 3 - Three Responses", label: "Writing Part 3" },
  { sheetName: "W_Part4", skill: "writing", part: "Part 4 - Formal & Informal Emails", label: "Writing Part 4" },
];
