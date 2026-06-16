import type { ExamQuestionRow } from "@/hooks/useExamSets";
import type { Question } from "@/data/questions";
import type { ReadingSentenceQuestion, ReadingCohesionQuestion, ReadingOpinionQuestion, ReadingLongQuestion } from "@/data/readingQuestions";
import type { ListeningPart1Question, ListeningPart2Question, ListeningPart3Question, ListeningPart4Clip } from "@/data/listeningQuestions";
import type { SpeakingPart1Data, SpeakingPart2Data, SpeakingPart3Data, SpeakingPart4Data } from "@/data/speakingQuestions";
import type { WritingPart1Data, WritingPart2Data, WritingPart3Data, WritingPart4Data } from "@/data/writingQuestions";

// ─── Grammar ────────────────────────────────────────────────
export const toGrammarQuestions = (rows: ExamQuestionRow[]): Question[] =>
  rows.map((r, i) => {
    const qt: Question["question_type"] =
      r.question_type === "fill_in_blank"
        ? "fill-in-blank"
        : r.question_type === "vocab_matching"
        ? "vocab_matching"
        : "mcq";
    return {
      id: i + 1,
      skill: "grammar" as const,
      question_text: r.question_text,
      options: r.options,
      correct_answer: r.correct_answer ?? 0,
      explanation: r.explanation || "",
      question_type: qt,
      audio_url: r.audio_url,
      extra_data: r.extra_data,
    };
  });

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
  const ed: any = first.extra_data || {};
  const raw: Array<{ text: string; correctPosition: number }> = Array.isArray(ed.sentences) ? ed.sentences : [];
  const group1 = raw
    .filter((s) => s.correctPosition >= 1 && s.correctPosition <= 5)
    .map((s) => ({ text: s.text, correctPosition: s.correctPosition }));
  const group2 = raw
    .filter((s) => s.correctPosition >= 6 && s.correctPosition <= 10)
    .map((s) => ({ text: s.text, correctPosition: s.correctPosition - 5 }));
  return {
    id: 1,
    type: "text-cohesion" as const,
    instruction: ed.instruction || "The sentences below are from some instructions. Put the sentences in the right order. The first sentence is done for you.",
    sections: [{ sentences: group1 }, { sentences: group2 }],
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
    script: r.explanation || "",
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
    script: first.explanation || "",
  }];
};


export const toListeningPart3 = (rows: ExamQuestionRow[]): ListeningPart3Question[] => {
  if (rows.length === 0) return [];
  const first = rows[0];
  return [{
    id: 1,
    audioUrl: first.audio_url || "",
    questionText: first.question_text || "",
    statements: rows.map((r) => ({
      text: r.question_text || "",
      correctAnswer: (() => {
        const n = Number(r.correct_answer);
        const map = ["man", "woman", "both"];
        if (!Number.isNaN(n) && map[n]) return map[n];
        return String(r.correct_answer ?? "").toLowerCase();
      })(),
    })),
    script: first.explanation || "",
  }];
};


export const toListeningPart4 = (rows: ExamQuestionRow[]): ListeningPart4Clip[] => {
  const clips: ListeningPart4Clip[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i];
    const b = rows[i + 1];
    if (!a) break;
    const questions = [a, b].filter(Boolean).map((r) => ({
      text: r!.question_text || "",
      options: r!.options || [],
      correct: r!.correct_answer ?? 0,
    }));
    clips.push({
      id: clips.length + 1,
      audioUrl: a.audio_url || "",
      questions,
      script: a.explanation || "",
    });
  }
  return clips;
};

// ─── Speaking ───────────────────────────────────────────────
const collectSampleAnswers = (rows: ExamQuestionRow[]): string[] =>
  rows.map((r) => (r.extra_data as any)?.sampleAnswer || r.explanation || "");

export const toSpeakingPart1 = (rows: ExamQuestionRow[]): SpeakingPart1Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 0,
    speakTime: ed.speakTime ?? 30,
    sampleAnswers: collectSampleAnswers(rows),
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
    sampleAnswers: collectSampleAnswers(rows),
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
    sampleAnswers: collectSampleAnswers(rows),
  };
};

export const toSpeakingPart4 = (rows: ExamQuestionRow[]): SpeakingPart4Data => {
  const first = rows[0];
  const ed = first?.extra_data || {};
  return {
    topic: ed.topic || first?.question_text || "",
    imageUrl: first?.image_url || "",
    questions: rows.map((r) => r.question_text),
    prepTime: ed.prepTime ?? 60,
    speakTime: ed.speakTime ?? 120,
    sampleAnswers: collectSampleAnswers(rows),
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
    instruction: ((ed.instruction || first?.question_text || "Fill in the form. Write in sentences. Use 20–30 words.").replace(/\s*\(Viết[^)]*\)/g, "").replace(/\s{2,}/g, " ").trim()),
    question: ed.question || ed.promptQuestions?.[0] || "",
    wordLimit: 30,
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
      instruction: (ed.informalEmail?.instruction || ed.informalEmail?.scenario || "").split("\n\n")[0].trim(),
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
