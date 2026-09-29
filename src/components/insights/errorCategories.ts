export type ErrorCategory =
  | "tense" | "article" | "preposition" | "plural" | "agreement"
  | "word_form" | "word_choice" | "spelling" | "sentence" | "other";

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  tense: "Thì động từ",
  article: "Mạo từ",
  preposition: "Giới từ",
  plural: "Số ít / số nhiều",
  agreement: "Hoà hợp chủ–vị",
  word_form: "Dạng từ",
  word_choice: "Dùng từ",
  spelling: "Chính tả",
  sentence: "Cấu trúc câu",
  other: "Khác",
};

export interface InsightError {
  original?: string;
  corrected?: string;
  explanation?: string;
  category?: string;
}

const RULES: [RegExp, ErrorCategory][] = [
  [/chính tả/i, "spelling"],
  [/mạo từ/i, "article"],
  [/giới từ/i, "preposition"],
  [/hoà hợp|hòa hợp|ngôi thứ ba/i, "agreement"],
  [/số nhiều|số ít|đếm được/i, "plural"],
  [/thì|quá khứ|hiện tại|tương lai|hoàn thành|tiếp diễn/i, "tense"],
  [/dạng từ|tính từ|trạng từ/i, "word_form"],
  [/dùng từ|sai nghĩa|từ vựng|không tự nhiên/i, "word_choice"],
  [/cấu trúc|trật tự|thiếu động từ|thiếu chủ ngữ/i, "sentence"],
];

export function categorize(err: InsightError | null | undefined, kind?: "grammar" | "spelling"): ErrorCategory {
  if (kind === "spelling") return "spelling";
  const c = err?.category;
  if (c && c in CATEGORY_LABEL) return c as ErrorCategory;
  const ex = String(err?.explanation ?? "");
  for (const [re, cat] of RULES) if (re.test(ex)) return cat;
  return "other";
}

export const asArray = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
