/**
 * Per-sheet parsers: convert raw Excel rows → exam_questions insert format
 * Each parser returns { questions, errors } where questions use the exam_questions schema
 */

import { SheetMapping, FULL_EXAM_SHEETS } from "./types";

interface ParsedQuestion {
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

interface ParseResult {
  questions: ParsedQuestion[];
  errors: { row: number; message: string }[];
}

const VALID_ANSWERS = ["A", "B", "C", "D"];

// Resolve sheet name → mapping (case-insensitive, trimmed)
export const resolveSheet = (name: string): SheetMapping | null => {
  const norm = name.trim().replace(/[\s-]+/g, "_");
  return FULL_EXAM_SHEETS.find((s) => s.sheetName.toLowerCase() === norm.toLowerCase()) || null;
};

// ─── MCQ parser (Grammar Part 1-4, Reading Part 1, Reading Part 4, Listening Part 1-4) ───
const parseMCQ = (rows: any[], needsAudio = false): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    if (!r.question_text?.toString().trim()) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ANSWERS.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A/B/C/D` }); return; }

    questions.push({
      order_index: i,
      question_text: r.question_text.toString().trim(),
      question_type: "multiple_choice",
      options: [r.option_a || "", r.option_b || "", r.option_c || "", r.option_d || ""].map((o: any) => o.toString().trim()),
      correct_answer: VALID_ANSWERS.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: needsAudio ? (r.audio_filename?.toString().trim() || null) : null,
      image_url: r.image_url?.toString().trim() || null,
      response_time: null,
      extra_data: r.sentence ? { sentence: r.sentence.toString().trim(), question: r.question_text.toString().trim() } : {},
    });
  });

  return { questions, errors };
};

// ─── Reading Part 1 (sentence + question + MCQ) ───
const parseReadingPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const sentence = r.sentence?.toString().trim();
    const question = r.question?.toString().trim() || r.question_text?.toString().trim();
    if (!sentence && !question) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu sentence hoặc question` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ANSWERS.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A/B/C/D` }); return; }

    questions.push({
      order_index: i,
      question_text: question || sentence || "",
      question_type: "multiple_choice",
      options: [r.option_a || "", r.option_b || "", r.option_c || "", r.option_d || ""].map((o: any) => o.toString().trim()),
      correct_answer: VALID_ANSWERS.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: null,
      extra_data: { sentence: sentence || "", question: question || "" },
    });
  });

  return { questions, errors };
};

// ─── Reading Part 2 (passage + sentence options + gaps) ───
// Row format: passage (col, same value for all rows or just row 1), sentence_option, gap_index, is_correct (1/0 or TRUE/FALSE)
const parseReadingPart2 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const passage = rows[0].passage?.toString().trim();
  if (!passage) { errors.push({ row: 2, message: "Dòng 2: Thiếu passage (cột passage ở dòng đầu)" }); }

  const sentenceOptions: string[] = [];
  const gapMap: Record<number, number> = {}; // gapIndex → correct sentenceOption index

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const opt = r.sentence_option?.toString().trim();
    if (!opt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu sentence_option` }); return; }
    const idx = sentenceOptions.length;
    sentenceOptions.push(opt);
    const gapIdx = r.gap_index != null ? Number(r.gap_index) : null;
    if (gapIdx != null && !isNaN(gapIdx)) {
      gapMap[gapIdx] = idx;
    }
  });

  const gaps = Object.keys(gapMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((gi) => ({ correct: gapMap[gi] }));

  if (errors.length > 0) return { questions: [], errors };

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: passage || "",
    question_type: "text_cohesion",
    options: sentenceOptions,
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null,
    image_url: null,
    response_time: null,
    extra_data: { passage, sentenceOptions, gaps },
  }];

  return { questions, errors };
};

// ─── Reading Part 3 (people + statements) ───
// Rows: person_name, person_text, statement, correct_person (name)
const parseReadingPart3 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const peopleMap = new Map<string, string>();
  const statements: { text: string; correctPerson: number }[] = [];

  // First pass: collect unique people
  rows.forEach((r) => {
    const name = r.person_name?.toString().trim();
    const text = r.person_text?.toString().trim();
    if (name && text && !peopleMap.has(name)) {
      peopleMap.set(name, text);
    }
  });

  const people = Array.from(peopleMap.entries()).map(([name, text]) => ({ name, text }));
  const personNames = people.map((p) => p.name);

  // Second pass: collect statements
  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const stmt = r.statement?.toString().trim();
    if (!stmt) return; // skip rows without statement
    const correctName = r.correct_person?.toString().trim();
    const personIdx = personNames.indexOf(correctName);
    if (personIdx < 0) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_person "${correctName}" không tìm thấy` }); return; }
    statements.push({ text: stmt, correctPerson: personIdx });
  });

  if (people.length === 0) errors.push({ row: 2, message: "Không tìm thấy person nào" });

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: rows[0].instruction?.toString().trim() || "Match the statements to the people.",
    question_type: "opinion_matching",
    options: [],
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null,
    image_url: null,
    response_time: null,
    extra_data: { people, statements },
  }];

  return { questions, errors };
};

// ─── Reading Part 4 (passage + MCQ questions) ───
const parseReadingPart4 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const passage = rows[0].passage?.toString().trim();
  if (!passage) errors.push({ row: 2, message: "Dòng 2: Thiếu passage" });

  const subQuestions: { text: string; options: string[]; correct: number }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ANSWERS.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A/B/C/D` }); return; }
    subQuestions.push({
      text: qt,
      options: [r.option_a || "", r.option_b || "", r.option_c || "", r.option_d || ""].map((o: any) => o.toString().trim()),
      correct: VALID_ANSWERS.indexOf(ans),
    });
  });

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: passage || "",
    question_type: "long_reading",
    options: [],
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null,
    image_url: null,
    response_time: null,
    extra_data: { passage, questions: subQuestions },
  }];

  return { questions, errors };
};

// ─── Speaking Part 1 (questions + times) ───
const parseSpeakingPart1 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  const questions: ParsedQuestion[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: Number(r.speak_time) || 30,
      extra_data: { prepTime: Number(r.prep_time) || 0, speakTime: Number(r.speak_time) || 30 },
    });
  });

  return { questions, errors };
};

// ─── Speaking Part 2 (single image + prompt) ───
const parseSpeakingPart2 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };
  const r = rows[0];
  const prompt = r.prompt?.toString().trim() || r.question_text?.toString().trim();
  if (!prompt) return { questions: [], errors: [{ row: 2, message: "Thiếu prompt" }] };

  return {
    questions: [{
      order_index: 0,
      question_text: prompt,
      question_type: "speaking",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: r.image_url?.toString().trim() || null,
      response_time: Number(r.speak_time) || 45,
      extra_data: { prepTime: Number(r.prep_time) || 45, speakTime: Number(r.speak_time) || 45 },
    }],
    errors: [],
  };
};

// ─── Speaking Part 3 (two images + prompt) ───
const parseSpeakingPart3 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };
  const r = rows[0];
  const prompt = r.prompt?.toString().trim() || r.question_text?.toString().trim();
  if (!prompt) return { questions: [], errors: [{ row: 2, message: "Thiếu prompt" }] };

  return {
    questions: [{
      order_index: 0,
      question_text: prompt,
      question_type: "speaking",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: r.image_url_1?.toString().trim() || null,
      response_time: Number(r.speak_time) || 60,
      extra_data: {
        prepTime: Number(r.prep_time) || 45,
        speakTime: Number(r.speak_time) || 60,
        imageUrl1: r.image_url_1?.toString().trim() || "",
        imageUrl2: r.image_url_2?.toString().trim() || "",
      },
    }],
    errors: [],
  };
};

// ─── Speaking Part 4 (topic + questions) ───
const parseSpeakingPart4 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const topic = rows[0].topic?.toString().trim() || "";
  const questions: ParsedQuestion[] = [];

  rows.forEach((r, i) => {
    const qt = r.question_text?.toString().trim();
    if (!qt && i === 0 && topic) return; // first row might only have topic
    if (!qt) return;
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: Number(r.speak_time) || 120,
      extra_data: {
        topic,
        prepTime: Number(r.prep_time) || 60,
        speakTime: Number(r.speak_time) || 120,
      },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 1 (short answers) ───
const parseWritingPart1 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  const questions: ParsedQuestion[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: null,
      extra_data: { sampleAnswer: r.sample_answer?.toString().trim() || "" },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 2 (social media) ───
const parseWritingPart2 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };
  const r = rows[0];

  const promptQuestions = rows.filter((r) => r.prompt_question?.toString().trim()).map((r) => r.prompt_question.toString().trim());

  return {
    questions: [{
      order_index: 0,
      question_text: r.social_post_content?.toString().trim() || "",
      question_type: "writing",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: null,
      extra_data: {
        socialPost: {
          author: r.social_post_author?.toString().trim() || "User",
          content: r.social_post_content?.toString().trim() || "",
        },
        promptQuestions,
        wordLimit: Number(r.word_limit) || 30,
        sampleAnswer: r.sample_answer?.toString().trim() || "",
      },
    }],
    errors: [],
  };
};

// ─── Writing Part 3 (three questions) ───
const parseWritingPart3 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  const questions: ParsedQuestion[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [],
      correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: null,
      response_time: null,
      extra_data: {
        sampleAnswer: r.sample_answer?.toString().trim() || "",
        wordLimit: Number(r.word_limit) || 40,
      },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 4 (two emails) ───
const parseWritingPart4 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  // Expect 2 rows: informal + formal
  const informal = rows[0];
  const formal = rows[1] || rows[0];

  const parseBullets = (val: any) => {
    if (!val) return [];
    return val.toString().split(/[;\n]/).map((s: string) => s.trim()).filter(Boolean);
  };

  return {
    questions: [
      {
        order_index: 0,
        question_text: informal.scenario?.toString().trim() || "",
        question_type: "writing",
        options: [],
        correct_answer: 0,
        explanation: informal.sample_answer?.toString().trim() || "",
        audio_url: null,
        image_url: null,
        response_time: null,
        extra_data: {
          informalEmail: {
            label: "Informal Email (~50 words)",
            scenario: informal.scenario?.toString().trim() || "",
            bulletPoints: parseBullets(informal.bullet_points),
            wordLimit: Number(informal.word_limit) || 50,
            sampleAnswer: informal.sample_answer?.toString().trim() || "",
          },
          formalEmail: {
            label: "Formal Email (~120-150 words)",
            scenario: formal.scenario?.toString().trim() || "",
            bulletPoints: parseBullets(formal.bullet_points),
            wordLimit: Number(formal.word_limit) || 150,
            sampleAnswer: formal.sample_answer?.toString().trim() || "",
          },
        },
      },
    ],
    errors: [],
  };
};

// ─── Main dispatch ───
export const parseSheet = (sheetName: string, rows: any[]): ParseResult & { mapping: SheetMapping | null } => {
  const mapping = resolveSheet(sheetName);
  if (!mapping) return { questions: [], errors: [], mapping: null };

  const key = mapping.sheetName;
  let result: ParseResult;

  switch (key) {
    // Grammar (all MCQ)
    case "GV_Part1":
    case "GV_Part2":
    case "GV_Part3":
    case "GV_Part4":
      result = parseMCQ(rows);
      break;

    // Reading
    case "R_Part1":
      result = parseReadingPart1(rows);
      break;
    case "R_Part2":
      result = parseReadingPart2(rows);
      break;
    case "R_Part3":
      result = parseReadingPart3(rows);
      break;
    case "R_Part4":
      result = parseReadingPart4(rows);
      break;

    // Listening (all MCQ + audio)
    case "L_Part1":
    case "L_Part2":
    case "L_Part3":
    case "L_Part4":
      result = parseMCQ(rows, true);
      break;

    // Speaking
    case "S_Part1":
      result = parseSpeakingPart1(rows);
      break;
    case "S_Part2":
      result = parseSpeakingPart2(rows);
      break;
    case "S_Part3":
      result = parseSpeakingPart3(rows);
      break;
    case "S_Part4":
      result = parseSpeakingPart4(rows);
      break;

    // Writing
    case "W_Part1":
      result = parseWritingPart1(rows);
      break;
    case "W_Part2":
      result = parseWritingPart2(rows);
      break;
    case "W_Part3":
      result = parseWritingPart3(rows);
      break;
    case "W_Part4":
      result = parseWritingPart4(rows);
      break;

    default:
      result = { questions: [], errors: [{ row: 0, message: `Parser không hỗ trợ sheet: ${key}` }] };
  }

  return { ...result, mapping };
};
