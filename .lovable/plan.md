

# Plan: Connect exam_sets/exam_questions to Practice Pages

## Problem
All 5 skill pages (Grammar, Reading, Listening, Speaking, Writing) currently use hardcoded mock data and generate fake test cards (9 per part). They need to fetch real exam sets from the database while keeping mock data as fallback.

## Architecture

Create a shared data-fetching hook and per-skill transformer functions that convert generic `exam_questions` rows into the specific data structures each exam engine expects.

```text
exam_sets (DB)  ──►  useExamSets(skill)  ──►  Test card list (real titles, time_limit)
exam_questions  ──►  fetchExamQuestions(setId)  ──►  transformToPartData(skill, part)  ──►  Engine props
```

## Implementation Steps

### 1. Create shared hook: `src/hooks/useExamSets.ts`
- `useExamSets(skill: string)` — fetches published `exam_sets` filtered by skill, returns loading state + grouped-by-part data
- `fetchExamQuestions(examSetId: string)` — fetches all `exam_questions` for a given set, ordered by `order_index`

### 2. Create data transformer: `src/lib/examTransformers.ts`
Transform generic `exam_questions` rows into skill-specific interfaces:

- **Grammar**: Map to `Question[]` (question_text, options, correct_answer, explanation)
- **Reading**: Map to `ReadingSentenceQuestion[]`, `ReadingCohesionQuestion`, etc. using `extra_data` for part-specific fields (passage, gaps, people, statements)
- **Listening**: Map to `ListeningPart1Question[]` etc. using `audio_url` and options
- **Speaking**: Map to `SpeakingPart1Data` etc. using `extra_data` for prepTime/speakTime and `image_url`
- **Writing**: Map to `WritingPart1Data` etc. using `extra_data` for instruction, sampleAnswer, bulletPoints

### 3. Refactor each skill page
For each page (Reading, Listening, Speaking, Writing, GrammarVocabulary):

- Replace hardcoded `generateTests()` with real data from `useExamSets`
- Show DB exam sets as test cards (title from `exam_sets.title`, time from `exam_sets.time_limit`)
- On click "Luyen tap": fetch `exam_questions` for that set, transform to engine props
- Keep mock data as fallback when no DB sets exist for a part
- Show loading skeleton while fetching
- Display actual question count from DB on cards

### 4. Update `exam_sets.part` format standardization
The `SKILL_PARTS` in `types.ts` uses labels like "Part 1 - Sentence Completion". The `exam_sets.part` column needs to match consistently. The transformer will normalize part strings to `part1`/`part2`/`part3`/`part4` for engine routing.

## Technical Details

**Transformer pattern example (Reading Part 1):**
```typescript
// exam_questions rows → ReadingSentenceQuestion[]
const toReadingPart1 = (rows: ExamQuestionRow[]): ReadingSentenceQuestion[] =>
  rows.map((r, i) => ({
    id: i + 1,
    type: "sentence-comprehension",
    sentence: r.extra_data?.sentence || r.question_text,
    question: r.question_text,
    options: r.options as string[],
    correct: r.correct_answer,
    explanation: r.explanation || "",
  }));
```

**Page-level flow:**
```typescript
const { examSets, loading } = useExamSets("reading");
const partSets = examSets.filter(s => normalizePart(s.part) === activeTab);

const handleStartTest = async (set: ExamSetRow) => {
  const questions = await fetchExamQuestions(set.id);
  const engineData = transformReadingData(normalizePart(set.part), questions);
  setExam({ active: true, partType: ..., data: engineData, ... });
};
```

## Files to Create
- `src/hooks/useExamSets.ts` — shared hook for fetching exam sets + questions
- `src/lib/examTransformers.ts` — all skill-specific data transformers

## Files to Modify
- `src/pages/Reading.tsx` — fetch from DB, transform, fallback to mock
- `src/pages/Listening.tsx` — same pattern
- `src/pages/Speaking.tsx` — same pattern
- `src/pages/Writing.tsx` — same pattern
- `src/pages/GrammarVocabulary.tsx` — same pattern

## Scope
No database changes needed. No new tables or columns. Pure frontend refactor using existing `exam_sets` and `exam_questions` schema.

