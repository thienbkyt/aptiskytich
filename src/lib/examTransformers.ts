import type { ExamQuestionRow } from "@/hooks/useExamSets";
import type { Question } from "@/data/questions";
import type { ReadingSentenceQuestion, ReadingCohesionQuestion, ReadingOpinionQuestion, ReadingLongQuestion } from "@/data/readingQuestions";
import type { ListeningPart1Question, ListeningPart2Question, ListeningPart3Question, ListeningPart4Question } from "@/data/listeningQuestions";
import type { SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data } from "@/data/speakingQuestions";
import type { WritingPart1Data, WritingPart2Data, WritingPart3Data, WritingPart4Data } from "@/data/writingQuestions";

// ─── Grammar ────────────────────────────────────────────────
export const toGrammarQuestions = (rows: ExamQuestionRow[]): Question[] =>
  rows.map((r, i) => ({
    id: i + 1,
    skill: "grammar" as const,
    question_text: r.question_text,
    options: r.options,
    correct_answer: r.correct_answer ?? 0,
    explanation: r.explanation || "",
    question_type: (r.question_type === "fill_in_blank" ? "fill-in-blank" : "mcq") as Question["question_type"],
    audio_url: r.audio_url,
  }));

// ─── Reading ────────────────────────────────────────────────
export const toReadingPart1 = (rows: ExamQuestionRow[]): ReadingSentenceQuestion | null => {
  if (rows.length === 0) return null;
  const first = rows[0];
  const ed = first.extra_data || {};
  return {
    id: 1,
    type: "gap-fill" as const,
    instruction: ed.instruction || "Read the text below. Choose one word from the list for each gap.",
    passage: ed.passage || first.question_text,
    gaps: ed.gaps || [],
    explanation: first.explanation || "",
  };
};

export const toReadingPart2 = (rows: ExamQuestionRow[]): ReadingCohesionQuestion | null => {
  if (rows.length === 0) return null;
  const first = rows[0];
  const ed = first.extra_data || {};
  return {
    id: 1,
    type: "text-cohesion" as const,
    instruction: ed.instruction || "Read the text below. Choose the correct sentence from the list to fill each gap.",
    passage: ed.passage || first.question_text,
    sentenceOptions: ed.sentenceOptions || first.options,
    gaps: ed.gaps || [{ correct: 0 }],
    explanation: first.explanation || "",
  };
};

export const toReadingPart3 = (rows: ExamQuestionRow[]): ReadingOpinionQuestion | null => {
  if (rows.length === 0) return null;
  const first = rows[0];
  const ed = first.extra_data || {};
  // Support new gap_fill_reading format stored as opinion-matching shape for engine
  return {
    id: 1,
    type: "opinion-matching" as const,
    instruction: ed.instruction || first.question_text,
    people: ed.people || [],
    statements: ed.statements || [],
    explanation: first.explanation || "",
  };
};

export const toReadingPart4 = (rows: ExamQuestionRow[]): ReadingLongQuestion | null => {
  if (rows.length === 0) return null;
  const first = rows[0];
  const ed = first.extra_data || {};

  // New heading-matching format
  if (ed.paragraphs && ed.headings) {
    return {
      id: 1,
      type: "long-reading" as const,
      instruction: ed.instruction || "Read the passage quickly. Choose a heading for each numbered paragraph (1–7) from the drop-down box. There is one more heading than you need.",
      passage: ed.passage || first.question_text,
      title: ed.title || "",
      paragraphs: ed.paragraphs,
      headings: ed.headings,
      questions: [],
      explanation: first.explanation || "",
    };
  }

  // Legacy MCQ format
  return {
    id: 1,
    type: "long-reading" as const,
    instruction: ed.instruction || "Read the text below and answer the questions.",
    passage: ed.passage || first.question_text,
    questions: ed.questions || rows.map((r) => ({
      text: r.question_text,
      options: r.options,
      correct: r.correct_answer ?? 0,
    })),
    explanation: first.explanation || "",
  };
};

// ─── Listening ──────────────────────────────────────────────
export const toListeningPart1 = (rows: ExamQuestionRow[]): ListeningPart1Question[] =>
  rows.map((r, i) => ({
    id: i + 1,
    audioUrl: r.audio_url || "",
    questionText: r.question_text || "",
    options: r.options,
    correct: r.correct_answer ?? 0,
  }));

export const toListeningPart2 = (rows: ExamQuestionRow[]): ListeningPart2Question[] => {
  if (rows.length === 0) return [];
  const first = rows[0];
  const ed: any = first.extra_data || {};
  const fallbackAudio = first.audio_url || "";
  const rawPersons: Array<{ name: string; audioUrl: string }> = Array.isArray(ed.persons) ? ed.persons : [];
  const byName = new Map(rawPersons.map((p) => [p.name, p]));
  const persons = ["A", "B", "C", "D"].map((name) => {
    const existing = byName.get(name);
    return { name, audioUrl: existing?.audioUrl || fallbackAudio };
  });
  return [{
    id: 1,
    audioUrl: fallbackAudio,
    questionText: first.question_text || "",
    persons,
    infoItems: ed.infoItems || [],
  }];
};


export const toListeningPart3 = (rows: ExamQuestionRow[]): ListeningPart3Question[] =>
  rows.map((r, i) => ({
    id: i + 1,
    audioUrl: r.audio_url || "",
    questionText: r.question_text,
    options: r.options,
    correct: r.correct_answer ?? 0,
  }));

export const toListeningPart4 = (rows: ExamQuestionRow[]): ListeningPart4Question[] =>
  rows.map((r, i) => ({
    id: i + 1,
    audioUrl: r.audio_url || "",
    questionText: r.question_text,
    options: r.options,
    correct: r.correct_answer ?? 0,
  }));

// ─── Speaking ───────────────────────────────────────────────
export const toSpeakingPart1 = (rows: ExamQuestionRow[]): SpeakingPart1Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 0,
    speakTime: ed.speakTime ?? 30,
  };
};

export const toSpeakingPart2 = (rows: ExamQuestionRow[]): SpeakingPart2Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    imageUrl: first?.image_url || "",
    prompt: first?.question_text || "",
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 45,
    speakTime: ed.speakTime ?? 45,
  };
};

export const toSpeakingPart3 = (rows: ExamQuestionRow[]): SpeakingPart3Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    imageUrl1: ed.imageUrl1 || first?.image_url || "",
    imageUrl2: ed.imageUrl2 || "",
    prompt: first?.question_text || "",
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 45,
    speakTime: ed.speakTime ?? 60,
  };
};

export const toSpeakingPart4 = (rows: ExamQuestionRow[]): SpeakingPart4Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    topic: ed.topic || first?.question_text || "",
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 60,
    speakTime: ed.speakTime ?? 120,
  };
};

// ─── Writing ────────────────────────────────────────────────
export const toWritingPart1 = (rows: ExamQuestionRow[]): WritingPart1Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    type: "short-answers",
    instruction: ed.instruction || "Answer the following questions. Write between 1 and 5 words for each answer.",
    questions: rows.map((r, i) => ({
      id: i + 1,
      text: r.question_text,
      sampleAnswer: r.extra_data?.sampleAnswer || r.explanation || "",
    })),
  };
};

export const toWritingPart2 = (rows: ExamQuestionRow[]): WritingPart2Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    type: "form-fill",
    instruction: ed.instruction || first?.question_text || "Fill in the form. Write in sentences. Use 20–30 words.",
    question: ed.question || ed.promptQuestions?.[0] || "",
    wordLimit: ed.wordLimit ?? 45,
    sampleAnswer: ed.sampleAnswer || first?.explanation || "",
  };
};

export const toWritingPart3 = (rows: ExamQuestionRow[]): WritingPart3Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    type: "three-questions",
    instruction: ed.instruction || "Answer the following three questions. Write between 30 and 40 words for each answer.",
    questions: rows.map((r, i) => ({
      id: i + 1,
      text: r.question_text,
      sampleAnswer: r.extra_data?.sampleAnswer || r.explanation || "",
    })),
    wordLimit: ed.wordLimit ?? 40,
  };
};

export const toWritingPart4 = (rows: ExamQuestionRow[]): WritingPart4Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    type: "two-emails",
    scenarioIntro: ed.scenarioIntro || ed.instruction || first?.question_text || "",
    scenarioEmail: ed.scenarioEmail || "",
    informalEmail: {
      instruction: ed.informalEmail?.instruction || ed.informalEmail?.scenario || "",
      wordLimit: ed.informalEmail?.wordLimit ?? 75,
      sampleAnswer: ed.informalEmail?.sampleAnswer || "",
    },
    formalEmail: {
      instruction: ed.formalEmail?.instruction || ed.formalEmail?.scenario || "",
      wordLimit: ed.formalEmail?.wordLimit ?? 225,
      sampleAnswer: ed.formalEmail?.sampleAnswer || "",
    },
  };
};
