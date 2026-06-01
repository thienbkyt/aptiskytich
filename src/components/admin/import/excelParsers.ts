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

// ─── Reading Part 1: Gap Fill — passage with inline dropdowns ───
// Gaps format: "{0} view,large,boat:view\n{1} sunny,large,boat:large" 
// Each line: {n} option1,option2,...:correct_answer
// Also supports legacy JSON format for backward compatibility
const parseGapsString = (gapsStr: string): { options: string[]; correct: number }[] => {
  const gapMap: Record<number, { options: string[]; correct: number }> = {};
  let maxIdx = -1;
  const lines = gapsStr.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Match: {n} option1,option2,...:correct_answer
    const match = line.match(/^\{(\d+)\}\s*(.+):(.+)$/);
    if (!match) continue;
    const gapIdx = parseInt(match[1]);
    const optionsStr = match[2].trim();
    const correctStr = match[3].trim();
    const options = optionsStr.split(",").map(o => o.trim()).filter(Boolean);
    const correctIdx = options.indexOf(correctStr);
    gapMap[gapIdx] = { options, correct: correctIdx >= 0 ? correctIdx : 0 };
    if (gapIdx > maxIdx) maxIdx = gapIdx;
  }
  // Build array aligned to indices used in passage placeholders
  const gaps: { options: string[]; correct: number }[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    gaps.push(gapMap[i] || { options: [], correct: 0 });
  }
  return gaps;
};

const parseReadingPart1 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const first = rows[0];
  if (first.passage) {
    let gaps: { options: string[]; correct: number }[] = [];
    if (first.gaps) {
      const gapsRaw = first.gaps.toString().trim();
      // Try new format first: {0} opt1,opt2:correct
      if (gapsRaw.includes("{") && gapsRaw.includes(":")) {
        gaps = parseGapsString(gapsRaw);
      }
      // Fallback to JSON
      if (gaps.length === 0) {
        try {
          const parsed = JSON.parse(gapsRaw);
          if (Array.isArray(parsed)) gaps.push(...parsed);
        } catch { errors.push({ row: 2, message: "Không parse được trường gaps" }); }
      }
    }

    return {
      questions: [{
        order_index: 0,
        question_text: first.passage.toString().trim(),
        question_type: "gap_fill",
        options: [],
        correct_answer: 0,
        explanation: first.explanation?.toString().trim() || "",
        audio_url: null, image_url: null, response_time: null,
        extra_data: {
          instruction: first.instruction?.toString().trim() || "Read the text below. Choose one word from the list for each gap.",
          passage: first.passage.toString().trim(),
          gaps,
        },
      }],
      errors,
    };
  }

  // Fallback: treat each row as a gap
  const gaps: { options: string[]; correct: number }[] = [];
  let passage = "";
  let instruction = "";
  let explanation = "";

  rows.forEach((r, i) => {
    const opts = (r.options || "").toString().split(",").map((s: string) => s.trim()).filter(Boolean);
    const correct = parseInt(r.correct_answer || "0");
    if (opts.length === 0) { errors.push({ row: i + 2, message: `Dòng ${i + 2}: Thiếu options` }); return; }
    gaps.push({ options: opts, correct: isNaN(correct) ? 0 : correct });
    if (!passage && r.passage) passage = r.passage.toString().trim();
    if (!instruction && r.instruction) instruction = r.instruction.toString().trim();
    if (!explanation && r.explanation) explanation = r.explanation.toString().trim();
  });

  return {
    questions: [{
      order_index: 0,
      question_text: passage,
      question_type: "gap_fill",
      options: [],
      correct_answer: 0,
      explanation,
      audio_url: null, image_url: null, response_time: null,
      extra_data: { instruction, passage, gaps },
    }],
    errors,
  };
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

// ─── Reading Part 3: Opinion Matching — 4 people texts + 7 questions with dropdown answers ───
// Columns: instruction, texts (A: Name\nText...\nB: Name\nText...), questions_answers (Question?: Answer\n...)
const parseReadingPart3 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const first = rows[0];
  const instruction = first.instruction?.toString().trim() || "Read the texts and then answer the questions below.";
  const textsRaw = first.texts?.toString().trim() || "";
  const qaRaw = first.questions_answers?.toString().trim() || "";

  // Parse people from texts: "A: Name\nText...\nB: Name\nText..."
  const people: { name: string; text: string }[] = [];
  if (textsRaw) {
    // Split by letter markers: A:, B:, C:, D: at line start
    const parts = textsRaw.split(/^([A-D]):\s*/m).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const marker = parts[i].trim();
      if (/^[A-D]$/.test(marker) && i + 1 < parts.length) {
        const block = parts[i + 1].trim();
        const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
        const name = lines[0] || marker;
        const text = lines.slice(1).join("\n");
        people.push({ name, text });
        i++; // skip the text block
      }
    }
  }

  if (people.length === 0) errors.push({ row: 2, message: "Không tách được danh sách người từ cột texts. Dùng format: A: Tên\\nNội dung\\nB: Tên\\nNội dung" });

  // Parse questions and answers: "Question text?: AnswerLetter\n..."
  const statements: { text: string; correctPerson: number }[] = [];
  if (qaRaw) {
    const qaLines = qaRaw.split("\n").map(l => l.trim()).filter(Boolean);
    const personLetters = ["A", "B", "C", "D"];
    for (const line of qaLines) {
      // Match: "Question text?: A" or "Question text: B"
      const match = line.match(/^(.+?):\s*([A-D])\s*$/i);
      if (match) {
        const qText = match[1].trim();
        const ansLetter = match[2].toUpperCase();
        const personIdx = personLetters.indexOf(ansLetter);
        statements.push({ text: qText, correctPerson: personIdx >= 0 ? personIdx : 0 });
      }
    }
  }

  if (statements.length === 0) errors.push({ row: 2, message: "Không tách được câu hỏi từ cột questions_answers. Dùng format: Who thinks X?: A" });

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: instruction,
    question_type: "opinion_matching",
    options: people.map(p => p.name),
    correct_answer: 0,
    explanation: first.explanation?.toString().trim() || "",
    audio_url: null, image_url: null, response_time: null,
    extra_data: {
      instruction,
      people,
      statements,
    },
  }];

  return { questions, errors };
};

// ─── Reading Part 4: Heading Matching — match headings to numbered paragraphs ───
// New format: title (col A), paragraphs (col B, numbered "1. text\n2. text"), headings_answers (col C, "Heading\n" or "Heading: 1\n")
const parseReadingPart4 = (rows: any[]): ParseResult => {
  const errors: { row: number; message: string }[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const first = rows[0];
  const title = first.title?.toString().trim() || "";
  const paragraphsRaw = first.paragraphs?.toString().trim() || first.passage?.toString().trim() || "";
  const headingsRaw = first.headings_answers?.toString().trim() || "";

  // Parse paragraphs: split by numbered pattern "1. text", "2. text" etc.
  const paragraphs: { index: number; text: string }[] = [];
  if (paragraphsRaw) {
    const parts = paragraphsRaw.split(/(?=^\d+\.\s)/m).filter((s: string) => s.trim());
    for (const part of parts) {
      const match = part.match(/^(\d+)\.\s*([\s\S]*)/);
      if (match) {
        paragraphs.push({ index: parseInt(match[1]), text: match[2].trim() });
      }
    }
  }
  if (paragraphs.length === 0) errors.push({ row: 2, message: "Không tách được đoạn văn. Dùng format: 1. Đoạn văn 1\\n2. Đoạn văn 2..." });

  // Parse headings: each line is either "Heading text" (distractor) or "Heading text: N" (correct for paragraph N)
  const headings: { text: string; paragraphIndex: number | null }[] = [];
  if (headingsRaw) {
    const lines = headingsRaw.split("\n").map((l: string) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(.+?):\s*(\d+)\s*$/);
      if (match) {
        headings.push({ text: match[1].trim(), paragraphIndex: parseInt(match[2]) });
      } else {
        headings.push({ text: line.trim(), paragraphIndex: null });
      }
    }
  }
  if (headings.length === 0) errors.push({ row: 2, message: "Không tách được headings. Dùng format: Heading text\\nHeading text: 1" });

  // Also support legacy format with passage/heading/paragraph_index/is_extra columns
  if (paragraphs.length === 0 && headings.length === 0 && first.passage && first.heading) {
    const passage = first.passage?.toString().trim();
    const legacyHeadings: { text: string; paragraphIndex: number | null }[] = [];
    rows.forEach((r: any, i: number) => {
      const heading = r.heading?.toString().trim();
      if (!heading) return;
      const isExtra = r.is_extra?.toString().toLowerCase() === "true" || r.is_extra === true;
      const paraIdx = isExtra ? null : Number(r.paragraph_index);
      legacyHeadings.push({ text: heading, paragraphIndex: isExtra ? null : (isNaN(paraIdx!) ? null : paraIdx!) });
    });

    return {
      questions: [{
        order_index: 0,
        question_text: passage || "",
        question_type: "long_reading",
        options: legacyHeadings.map(h => h.text),
        correct_answer: 0,
        explanation: first.explanation?.toString().trim() || "",
        audio_url: null, image_url: null, response_time: null,
        extra_data: { passage, headings: legacyHeadings, instruction: "Match the headings to the correct paragraphs." },
      }],
      errors,
    };
  }

  const questions: ParsedQuestion[] = [{
    order_index: 0,
    question_text: title || "Reading Part 4",
    question_type: "long_reading",
    options: headings.map(h => h.text),
    correct_answer: 0,
    explanation: first.explanation?.toString().trim() || "",
    audio_url: null, image_url: null, response_time: null,
    extra_data: {
      title,
      paragraphs,
      headings,
      instruction: first.instruction?.toString().trim() || "Read the passage quickly. Choose a heading for each numbered paragraph from the drop-down box. There is one more heading than you need.",
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

// ─── Writing Part 1: Short Answers — 5 questions, 1-5 words each ───
// Excel format: Col A = instruction, Col B = question_text, Col C = sample_answer
const parseWritingPart1 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  // Read instruction from first row Col A
  const firstKeys = Object.keys(rows[0] || {});
  const globalInstruction = (rows[0]?.instruction || rows[0]?.[firstKeys[0]] || "Answer the following questions. Write between 1 and 5 words for each answer.").toString().trim();

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const keys = Object.keys(r);
    // Col B = question_text
    const qt = (r.question_text || r[keys[1]] || "").toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text (Cột B)` }); return; }
    // Col C = sample_answer
    const sa = (r.sample_answer || r[keys[2]] || "").toString().trim();
    // Col A = instruction (same for all rows, taken from that row or fallback to global)
    const instruction = (r.instruction || r[keys[0]] || globalInstruction).toString().trim();

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: sa,
      audio_url: null, image_url: null, response_time: null,
      extra_data: { sampleAnswer: sa, instruction },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 2: Form Fill — 20-30 words ───
// Excel format: Col A = instruction, Col B = question, Col C = sample_answer
const parseWritingPart2 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };
  const r = rows[0];
  const keys = Object.keys(r);

  // Col A = instruction, Col B = question, Col C = sample_answer
  const instruction = (r.instruction || r.question_text || r[keys[0]] || "").toString().trim();
  const question = (r.question || r.prompt_question || r[keys[1]] || "").toString().trim();
  const sampleAnswer = (r.sample_answer || r[keys[2]] || "").toString().trim();

  return {
    questions: [{
      order_index: 0,
      question_text: instruction,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: sampleAnswer,
      audio_url: null, image_url: null, response_time: null,
      extra_data: {
        instruction,
        question,
        wordLimit: 45,
        sampleAnswer,
      },
    }],
    errors: [],
  };
};

// ─── Writing Part 3: Three Questions — 30-40 words each ───
// Excel format: Col A = instruction, Col B = question_text, Col C = sample_answer
const parseWritingPart3 = (rows: any[]): ParseResult => {
  const questions: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  const firstKeys = Object.keys(rows[0] || {});
  const globalInstruction = (rows[0]?.instruction || rows[0]?.[firstKeys[0]] || "Answer the following three questions. Write between 30 and 40 words for each answer.").toString().trim();

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const keys = Object.keys(r);
    const qt = (r.question_text || r[keys[1]] || "").toString().trim();
    if (!qt) { errors.push({ row: rowNum, message: `Dòng ${rowNum}: Thiếu question_text (Cột B)` }); return; }
    const sa = (r.sample_answer || r[keys[2]] || "").toString().trim();
    const instruction = (r.instruction || r[keys[0]] || globalInstruction).toString().trim();

    questions.push({
      order_index: i,
      question_text: qt,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: sa,
      audio_url: null, image_url: null, response_time: null,
      extra_data: { sampleAnswer: sa, wordLimit: 40, instruction },
    });
  });

  return { questions, errors };
};

// ─── Writing Part 4: Two emails (scenario-based) ───
const parseWritingPart4 = (rows: any[]): ParseResult => {
  if (rows.length === 0) return { questions: [], errors: [{ row: 2, message: "Sheet trống" }] };

  const r = rows[0];
  const scenarioIntro = r.scenario_intro?.toString().trim() || r[Object.keys(r)[0]]?.toString().trim() || "";
  const scenarioEmail = r.scenario_email?.toString().trim() || r[Object.keys(r)[1]]?.toString().trim() || "";
  const informalInstruction = r.informal_instruction?.toString().trim() || "Write an email to your friend. Write about your feelings and what you think the club should do about the situation. Write about 50 words. Recommended time: 10 minutes.";
  const formalInstruction = r.formal_instruction?.toString().trim() || "Write an email to the president of the club. Write about your feelings and what you think the club should do about the situation. Write 120–150 words. Recommended time: 20 minutes.";
  const sampleAnswer = r.sample_answer?.toString().trim() || r[Object.keys(r)[3]]?.toString().trim() || "";

  return {
    questions: [{
      order_index: 0,
      question_text: scenarioIntro,
      question_type: "writing",
      options: [], correct_answer: 0,
      explanation: sampleAnswer,
      audio_url: null, image_url: null, response_time: null,
      extra_data: {
        scenarioIntro,
        scenarioEmail,
        informalEmail: {
          instruction: informalInstruction,
          wordLimit: 75,
          sampleAnswer: "",
        },
        formalEmail: {
          instruction: formalInstruction,
          wordLimit: 225,
          sampleAnswer: sampleAnswer,
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
    case "G&V1-25": result = parseCoreGrammar(rows); break;
    case "G&V26": result = parseVocabPart1(rows); break;
    case "G&V27": result = parseVocabPart2(rows); break;
    case "G&V28": result = parseVocabPart3(rows); break;
    case "G&V29": result = parseVocabPart4(rows); break;
    case "G&V30": result = parseVocabPart5(rows); break;
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
