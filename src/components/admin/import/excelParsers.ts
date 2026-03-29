/**
 * Per-sheet parsers for Aptis General exam format
 * Based on official British Council Aptis General Test Format Overview 2023
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

const VALID_ABC = ["A", "B", "C"];
const VALID_ABCD = ["A", "B", "C", "D"];

export const resolveSheet = (name: string): SheetMapping | null => {
  const norm = name.trim().replace(/[\s-]+/g, "_");
  return FULL_EXAM_SHEETS.find((s) => s.sheetName.toLowerCase() === norm.toLowerCase()) || null;
};

// ─── Core Grammar: 25 MCQ × 3 options (A/B/C) ───
const parseCoreGrammar = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ABC.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A/B/C` }); return; }

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "multiple_choice",
      options: [r.option_a || "", r.option_b || "", r.option_c || ""].map((o: any) => o.toString().trim()),
      correct_answer: VALID_ABC.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: {},
    });
  });

  return { questions, errors };
};

// ─── Vocab shared: 11 options A-K ───
const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

const parseVocabPart = (rows: any[], vocabType: string, questionField: string): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r[questionField]?.toString().trim() || r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu ${questionField}` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !OPTION_KEYS.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A-K` }); return; }

    const options = OPTION_KEYS.map((k) => (r[`option_${k}`] || "").toString().trim());

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "vocab_matching",
      options,
      correct_answer: OPTION_KEYS.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: { vocabType, optionLabels: OPTION_KEYS },
    });
  });

  return { questions, errors };
};

const parseVocabPart1 = (rows: any[]): ParseResult => parseVocabPart(rows, "synonym", "word");
const parseVocabPart2 = (rows: any[]): ParseResult => parseVocabPart(rows, "sentence_definition", "sentence");
const parseVocabPart3 = (rows: any[]): ParseResult => parseVocabPart(rows, "definition_matching", "definition");
const parseVocabPart4 = (rows: any[]): ParseResult => parseVocabPart(rows, "gap_fill", "sentence");
const parseVocabPart5 = (rows: any[]): ParseResult => parseVocabPart(rows, "collocation", "word");

// ─── Reading Part 1: Sentence Comprehension — 5 sentences, 3 options each ───
const parseReadingPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const sentence = r.sentence?.toString().trim() || r.question_text?.toString().trim();
    if (!sentence) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu sentence` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ABC.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là A/B/C` }); return; }

    questions.push({
      order_index: i,
      question_text: sentence,
      question_type: "multiple_choice",
      options: [r.option_a || "", r.option_b || "", r.option_c || ""].map((o: any) => o.toString().trim()),
      correct_answer: VALID_ABC.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: { sentence },
    });
  });

  return { questions, errors };
};

// ─── Reading Part 2: Text Cohesion — 6 sentences in wrong order, reorder ───
// Each row = one sentence; columns: sentence_text, correct_position (1-6)
const parseReadingPart2 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const taskTitle = rows[0].task_title?.toString().trim() || "";
  const sentences: { text: string; correctPosition: number }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const text = r.sentence_text?.toString().trim();
    if (!text) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu sentence_text` }); return; }
    const pos = Number(r.correct_position);
    if (isNaN(pos) || pos < 1) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_position phải là số (1-6)` }); return; }
    sentences.push({ text, correctPosition: pos });
  });

  if (errors.length > 0) return { questions: [], errors };

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: taskTitle || "Put the sentences in the correct order.",
    question_type: "text_cohesion",
    options: sentences.map((s) => s.text),
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null, image_url: null, response_time: null,
    extra_data: {
      sentences: sentences.map((s) => ({ text: s.text, correctPosition: s.correctPosition })),
      instruction: "The sentences below make a complete text. Put them in the correct order.",
    },
  }];

  return { questions, errors };
};

// ─── Reading Part 3: Opinion Matching — 4 people, 7 statements ───
const parseReadingPart3 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const peopleMap = new Map<string, string>();
  const statements: { text: string; correctPerson: number }[] = [];

  rows.forEach((r) => {
    const name = r.person_name?.toString().trim();
    const text = r.person_text?.toString().trim();
    if (name && text && !peopleMap.has(name)) peopleMap.set(name, text);
  });

  const people = Array.from(peopleMap.entries()).map(([name, text]) => ({ name, text }));
  const personNames = people.map((p) => p.name);

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const stmt = r.statement?.toString().trim();
    if (!stmt) return;
    const correctName = r.correct_person?.toString().trim();
    const personIdx = personNames.indexOf(correctName);
    if (personIdx < 0) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_person "${correctName}" không tìm thấy` }); return; }
    statements.push({ text: stmt, correctPerson: personIdx });
  });

  if (people.length === 0) errors.push({ row: 2, message: "Không tìm thấy person nào" });

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: rows[0].topic?.toString().trim() || "Match the statements to the people.",
    question_type: "opinion_matching",
    options: [],
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null, image_url: null, response_time: null,
    extra_data: { people, statements },
  }];

  return { questions, errors };
};

// ─── Reading Part 4: Long Text (~750 words) — match 8 headings to 7 paragraphs ───
// Columns: passage (row 1 only), paragraph_index (1-7), heading, is_extra (TRUE for the extra heading)
const parseReadingPart4 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const passage = rows[0].passage?.toString().trim();
  if (!passage) errors.push({ row: 2, message: "Dòng 2: Thiếu passage" });

  const headings: { text: string; paragraphIndex: number | null }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const heading = r.heading?.toString().trim();
    if (!heading) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu heading` }); return; }
    const isExtra = r.is_extra?.toString().toLowerCase() === "true" || r.is_extra === true;
    const paraIdx = isExtra ? null : Number(r.paragraph_index);
    if (!isExtra && (isNaN(paraIdx!) || paraIdx! < 1)) {
      errors.push({ row: rowNum, message: `Dòng ${rowNum}: paragraph_index phải là số hoặc đánh dấu is_extra=TRUE` });
      return;
    }
    headings.push({ text: heading, paragraphIndex: isExtra ? null : paraIdx! });
  });

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: passage || "",
    question_type: "long_reading",
    options: headings.map((h) => h.text),
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: null, image_url: null, response_time: null,
    extra_data: {
      passage,
      headings,
      instruction: "Match the headings to the correct paragraphs. One heading is extra.",
    },
  }];

  return { questions, errors };
};

// ─── Listening Part 1: Information Recognition — short audio + MCQ ───
const parseListeningPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    const hasD = r.option_d?.toString().trim();
    const valid = hasD ? VALID_ABCD : VALID_ABC;
    if (!ans || !valid.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là ${hasD ? "A/B/C/D" : "A/B/C"}` }); return; }

    const opts = hasD
      ? [r.option_a, r.option_b, r.option_c, r.option_d]
      : [r.option_a, r.option_b, r.option_c];

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "multiple_choice",
      options: opts.map((o: any) => (o || "").toString().trim()),
      correct_answer: valid.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: r.audio_filename?.toString().trim() || null,
      image_url: null, response_time: null,
      extra_data: {},
    });
  });

  return { questions, errors };
};

// ─── Listening Part 2: Information Matching — 4 monologues, match to 6 info pieces ───
// Columns: person_name, audio_filename, info_text, correct_person
const parseListeningPart2 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const audioUrl = rows[0].audio_filename?.toString().trim() || null;
  const personsSet = new Map<string, string>();
  const infoItems: { text: string; correctPerson: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const person = r.person_name?.toString().trim();
    const audio = r.audio_filename?.toString().trim();
    if (person && audio && !personsSet.has(person)) personsSet.set(person, audio);

    const info = r.info_text?.toString().trim();
    if (!info) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu info_text` }); return; }
    const correct = r.correct_person?.toString().trim();
    if (!correct) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu correct_person` }); return; }
    infoItems.push({ text: info, correctPerson: correct });
  });

  const persons = Array.from(personsSet.entries()).map(([name, audio]) => ({ name, audioUrl: audio }));

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: "Listen to four people and match each person to the correct information.",
    question_type: "listening_matching",
    options: [],
    correct_answer: 0,
    explanation: rows[0].explanation?.toString().trim() || "",
    audio_url: audioUrl, image_url: null, response_time: null,
    extra_data: { persons, infoItems },
  }];

  return { questions, errors };
};

// ─── Listening Part 3: Opinion Matching — dialogue, man/woman/both ───
// Columns: question_text, correct_answer (man/woman/both), audio_filename, explanation
const parseListeningPart3 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];
  const audioUrl = rows[0]?.audio_filename?.toString().trim() || null;

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toLowerCase().trim();
    const validOps = ["man", "woman", "both"];
    if (!ans || !validOps.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là man/woman/both` }); return; }

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "opinion_matching",
      options: ["The man", "The woman", "Both"],
      correct_answer: validOps.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: r.audio_filename?.toString().trim() || audioUrl,
      image_url: null, response_time: null,
      extra_data: {},
    });
  });

  return { questions, errors };
};

// ─── Listening Part 4: Monologue Comprehension — monologue + 2 MCQ questions ───
const parseListeningPart4 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    const ans = r.correct_answer?.toString().toUpperCase().trim();
    const hasD = r.option_d?.toString().trim();
    const valid = hasD ? VALID_ABCD : VALID_ABC;
    if (!ans || !valid.includes(ans)) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: correct_answer phải là ${hasD ? "A/B/C/D" : "A/B/C"}` }); return; }

    const opts = hasD
      ? [r.option_a, r.option_b, r.option_c, r.option_d]
      : [r.option_a, r.option_b, r.option_c];

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "multiple_choice",
      options: opts.map((o: any) => (o || "").toString().trim()),
      correct_answer: valid.indexOf(ans),
      explanation: r.explanation?.toString().trim() || "",
      audio_url: r.audio_filename?.toString().trim() || null,
      image_url: null, response_time: null,
      extra_data: {},
    });
  });

  return { questions, errors };
};

// ─── Speaking Part 1: 3 personal questions, 30s each ───
const parseSpeakingPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: null,
      response_time: 30,
      extra_data: { prepTime: 0, speakTime: 30 },
    });
  });

  return { questions, errors };
};

// ─── Speaking Part 2: 1 photo + 3 questions, 45s each ───
const parseSpeakingPart2 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];
  const imageUrl = rows[0]?.image_url?.toString().trim() || null;

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: r.image_url?.toString().trim() || imageUrl,
      response_time: 45,
      extra_data: { prepTime: 0, speakTime: 45, imageUrl: imageUrl },
    });
  });

  return { questions, errors };
};

// ─── Speaking Part 3: 2 photos + 3 questions, 45s each ───
const parseSpeakingPart3 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];
  const imageUrl1 = rows[0]?.image_url_1?.toString().trim() || null;
  const imageUrl2 = rows[0]?.image_url_2?.toString().trim() || null;

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: imageUrl1,
      response_time: 45,
      extra_data: { prepTime: 0, speakTime: 45, imageUrl1, imageUrl2 },
    });
  });

  return { questions, errors };
};

// ─── Speaking Part 4: abstract topic, 1 min prep, 2 min speak, 3 questions ───
const parseSpeakingPart4 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];
  const topic = rows[0]?.topic?.toString().trim() || "";
  const imageUrl = rows[0]?.image_url?.toString().trim() || null;

  rows.forEach((r, i) => {
    const qt = r.question_text?.toString().trim();
    if (!qt) return;
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "speaking",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null,
      image_url: r.image_url?.toString().trim() || imageUrl,
      response_time: 120,
      extra_data: { topic, prepTime: 60, speakTime: 120 },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 1: Word-level — 5 text messages, answer with individual words ───
const parseWritingPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.message_text?.toString().trim() || r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu message_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: {
        sampleAnswer: r.sample_answer?.toString().trim() || "",
        context: r.context?.toString().trim() || "",
      },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 2: Short Text — 20-30 words ───
const parseWritingPart2 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };
  const r = rows[0];

  const promptQuestions = rows.filter((r) => r.prompt_question?.toString().trim()).map((r) => r.prompt_question.toString().trim());

  return {
    questions: [{
      order_index: 0,
      question_text: r.social_post_content?.toString().trim() || r.question_text?.toString().trim() || "",
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: {
        socialPost: {
          author: r.social_post_author?.toString().trim() || "User",
          content: r.social_post_content?.toString().trim() || "",
        },
        promptQuestions,
        wordLimit: 30,
        sampleAnswer: r.sample_answer?.toString().trim() || "",
      },
    }],
    errors: [],
  };
};

// ─── Writing Part 3: Three Responses — 30-40 words each ───
const parseWritingPart3 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const qt = r.question_text?.toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text` }); return; }
    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: r.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: { sampleAnswer: r.sample_answer?.toString().trim() || "", wordLimit: 40 },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 4: Informal (40-50 words) + Formal (120-150 words) ───
const parseWritingPart4 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const informal = rows[0];
  const formal = rows[1] || rows[0];

  const parseBullets = (val: any) => {
    if (!val) return [];
    return val.toString().split(/[;\n]/).map((s: string) => s.trim()).filter(Boolean);
  };

  return {
    questions: [{
      order_index: 0,
      question_text: informal.scenario?.toString().trim() || "",
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: informal.sample_answer?.toString().trim() || "",
      audio_url: null, image_url: null, response_time: null,
      extra_data: {
        changeInfo: rows[0].change_info?.toString().trim() || "",
        informalEmail: {
          label: "Informal Email (40-50 words)",
          scenario: informal.scenario?.toString().trim() || "",
          bulletPoints: parseBullets(informal.bullet_points),
          wordLimit: 50,
          sampleAnswer: informal.sample_answer?.toString().trim() || "",
        },
        formalEmail: {
          label: "Formal Email (120-150 words)",
          scenario: formal.scenario?.toString().trim() || "",
          bulletPoints: parseBullets(formal.bullet_points),
          wordLimit: 150,
          sampleAnswer: formal.sample_answer?.toString().trim() || "",
        },
      },
    }],
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
    case "Core_Grammar": result = parseCoreGrammar(rows); break;
    case "Core_Vocab": result = parseCoreVocab(rows); break;
    case "R_Part1": result = parseReadingPart1(rows); break;
    case "R_Part2": result = parseReadingPart2(rows); break;
    case "R_Part3": result = parseReadingPart3(rows); break;
    case "R_Part4": result = parseReadingPart4(rows); break;
    case "L_Part1": result = parseListeningPart1(rows); break;
    case "L_Part2": result = parseListeningPart2(rows); break;
    case "L_Part3": result = parseListeningPart3(rows); break;
    case "L_Part4": result = parseListeningPart4(rows); break;
    case "S_Part1": result = parseSpeakingPart1(rows); break;
    case "S_Part2": result = parseSpeakingPart2(rows); break;
    case "S_Part3": result = parseSpeakingPart3(rows); break;
    case "S_Part4": result = parseSpeakingPart4(rows); break;
    case "W_Part1": result = parseWritingPart1(rows); break;
    case "W_Part2": result = parseWritingPart2(rows); break;
    case "W_Part3": result = parseWritingPart3(rows); break;
    case "W_Part4": result = parseWritingPart4(rows); break;
    default: result = { questions: [], errors: [{ row: 0, message: `Parser không hỗ trợ: ${key}` }] };
  }

  return { ...result, mapping };
};
