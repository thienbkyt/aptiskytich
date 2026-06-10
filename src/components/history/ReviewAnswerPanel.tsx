import { Fragment, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

export interface ReviewQuestion {
  id: string;
  order_index: number;
  question_text: string;
  options: any;
  correct_answer: number | null;
  explanation: string | null;
  question_type?: string;
  extra_data?: any;
}

export interface ReviewQResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface Props {
  questions: ReviewQuestion[];
  qResults: ReviewQResult[];
  title?: string;
  defaultOpen?: boolean;
}

const optionLabel = (options: any, idx: number | null | undefined): string | null => {
  if (idx === null || idx === undefined || !Number.isFinite(idx as number)) return null;
  if (Array.isArray(options)) {
    const v = options[idx as number];
    return typeof v === "string" ? v : v != null ? String(v) : null;
  }
  return null;
};

/** Parse envelope `{partType, answers:[...]}` or a single index string. */
const parseEnvelope = (raw: string | null): { answers: any[] } | null => {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.answers)) return { answers: p.answers };
  } catch {
    /* not json */
  }
  return null;
};

const parseSingleIndex = (raw: string | null): number | null => {
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

const isGapFill = (q: ReviewQuestion): boolean => {
  const gaps = q.extra_data?.gaps;
  return Array.isArray(gaps) && /\{\d+\}/.test(q.question_text || "");
};

const isOpinionMatching = (q: ReviewQuestion): boolean =>
  q.question_type === "opinion_matching" && Array.isArray(q.extra_data?.statements);

const isLongReading = (q: ReviewQuestion): boolean =>
  q.question_type === "long_reading" && Array.isArray(q.extra_data?.headings);

const isTextCohesion = (q: ReviewQuestion): boolean =>
  q.question_type === "text_cohesion" && Array.isArray(q.extra_data?.sentences);

// ─── chip styles ──────────────────────────────────────────────────────────
const chipCorrect =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";
const chipWrong =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-destructive/10 text-destructive border border-destructive/20 line-through";
const chipBlank =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-muted text-muted-foreground border border-border";

interface SubStats { correct: number; wrong: number; blank: number; total: number }

// ─── gap-fill renderer (Reading Part 1) ───────────────────────────────────
const renderGapFillPassage = (q: ReviewQuestion, env: { answers: any[] } | null): { node: JSX.Element; stats: SubStats } => {
  const gaps: Array<{ options: string[]; correct: number }> = q.extra_data?.gaps || [];
  const parts = (q.question_text || "").split(/\{(\d+)\}/g);
  let correct = 0, wrong = 0, blank = 0, total = 0;

  const node = (
    <div className="text-base text-foreground leading-[2.2] whitespace-pre-line">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const gapIndex = parseInt(part, 10);
        const gap = gaps[gapIndex];
        if (!gap) return <span key={i} className="text-muted-foreground">{`{${gapIndex}}`}</span>;
        const isExample = !gap.options || gap.options.length === 0;
        const correctText = gap.options?.[gap.correct] ?? "";
        if (isExample) {
          return (
            <span key={i} className={chipCorrect} title="Ví dụ (đã cho sẵn)">
              {correctText || `{${gapIndex}}`}
            </span>
          );
        }
        total++;
        const userPick = env?.answers?.[gapIndex];
        const userText = userPick != null && Number.isFinite(userPick) ? gap.options[userPick as number] : null;
        if (userPick == null) {
          blank++;
          return (
            <Fragment key={i}>
              <span className={chipBlank}>—</span>
              <span className={chipCorrect}>{correctText}</span>
            </Fragment>
          );
        }
        if (userPick === gap.correct) {
          correct++;
          return <span key={i} className={chipCorrect}>{correctText}</span>;
        }
        wrong++;
        return (
          <Fragment key={i}>
            <span className={chipWrong}>{userText ?? "?"}</span>
            <span className={chipCorrect}>{correctText}</span>
          </Fragment>
        );
      })}
    </div>
  );

  return { node, stats: { correct, wrong, blank, total } };
};

// ─── generic sub-question table (opinion_matching, long_reading) ──────────
interface SubRow { prompt: string; userText: string | null; correctText: string; isBlank: boolean; isCorrect: boolean }

const renderSubTable = (rows: SubRow[]): { node: JSX.Element; stats: SubStats } => {
  let correct = 0, wrong = 0, blank = 0;
  rows.forEach((r) => {
    if (r.isBlank) blank++;
    else if (r.isCorrect) correct++;
    else wrong++;
  });
  const node = (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="flex-shrink-0 mt-0.5">
            {r.isBlank ? (
              <MinusCircle className="w-4 h-4 text-muted-foreground" />
            ) : r.isCorrect ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-foreground">
              <span className="text-muted-foreground font-medium mr-1">{i + 1}.</span>
              {r.prompt}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {r.isBlank ? (
                <>
                  <span className="text-xs text-muted-foreground">Bạn:</span>
                  <span className={chipBlank}>Bỏ trống</span>
                  <span className="text-xs text-muted-foreground ml-2">Đáp án:</span>
                  <span className={chipCorrect}>{r.correctText}</span>
                </>
              ) : r.isCorrect ? (
                <>
                  <span className="text-xs text-muted-foreground">Đáp án:</span>
                  <span className={chipCorrect}>{r.correctText}</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Bạn:</span>
                  <span className={chipWrong}>{r.userText ?? "?"}</span>
                  <span className="text-xs text-muted-foreground ml-2">Đáp án:</span>
                  <span className={chipCorrect}>{r.correctText}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  return { node, stats: { correct, wrong, blank, total: rows.length } };
};

const buildOpinionRows = (q: ReviewQuestion, env: { answers: any[] } | null): SubRow[] => {
  const statements: Array<{ text: string; correctPerson: number }> = q.extra_data?.statements || [];
  const opts = Array.isArray(q.options) ? q.options : [];
  return statements.map((s, i) => {
    const pick = env?.answers?.[i];
    const userText = optionLabel(opts, pick);
    const correctText = optionLabel(opts, s.correctPerson) ?? String(s.correctPerson);
    const isBlank = pick == null;
    return {
      prompt: s.text,
      userText,
      correctText,
      isBlank,
      isCorrect: !isBlank && pick === s.correctPerson,
    };
  });
};

const buildLongReadingRows = (q: ReviewQuestion, env: { answers: any[] } | null): SubRow[] => {
  const headings: Array<{ text: string; paragraphIndex: number }> = q.extra_data?.headings || [];
  const opts: string[] = Array.isArray(q.options) ? q.options : [];
  // Build per-paragraph rows. Paragraphs are 1..N (skip 0 if "example" exists).
  const paragraphIndices = Array.from(new Set(headings.map((h) => h.paragraphIndex))).sort((a, b) => a - b);
  // Heuristic: env.answers length tells us how many paragraphs the engine asked.
  const answersLen = env?.answers?.length ?? paragraphIndices.length;
  const rows: SubRow[] = [];
  for (let i = 0; i < answersLen; i++) {
    const pIdx = i + 1; // paragraphs are 1-indexed
    const correctHeading = headings.find((h) => h.paragraphIndex === pIdx);
    if (!correctHeading) continue;
    const correctIdxInOptions = opts.findIndex((o) => o === correctHeading.text);
    const pick = env?.answers?.[i];
    const userText = optionLabel(opts, pick);
    const isBlank = pick == null;
    rows.push({
      prompt: `Đoạn ${pIdx}`,
      userText,
      correctText: correctHeading.text,
      isBlank,
      isCorrect: !isBlank && pick === correctIdxInOptions,
    });
  }
  return rows;
};

// ─── text cohesion: just list the correct order, no per-answer diff ───────
const renderTextCohesion = (q: ReviewQuestion): { node: JSX.Element; stats: SubStats } => {
  const sentences: Array<{ text: string; correctPosition: number }> = q.extra_data?.sentences || [];
  const ordered = [...sentences].sort((a, b) => a.correctPosition - b.correctPosition);
  const node = (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Thứ tự đúng:</p>
      <ol className="space-y-1.5 list-decimal list-inside text-sm text-foreground">
        {ordered.map((s, i) => (
          <li key={i} className="leading-relaxed">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5">
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
  return { node, stats: { correct: 0, wrong: 0, blank: 0, total: ordered.length } };
};

// ─── normal MCQ user answer text resolution ───────────────────────────────
const resolveMcqUserText = (raw: string | null, options: any): { text: string; isBlank: boolean } => {
  if (raw == null || raw === "") return { text: "Bỏ trống", isBlank: true };
  // direct numeric
  const single = parseSingleIndex(raw);
  if (single != null) {
    const t = optionLabel(options, single);
    if (t) return { text: t, isBlank: false };
  }
  // envelope with one answer
  const env = parseEnvelope(raw);
  if (env && env.answers.length === 1) {
    const pick = env.answers[0];
    if (pick == null) return { text: "Bỏ trống", isBlank: true };
    const t = optionLabel(options, pick);
    if (t) return { text: t, isBlank: false };
  }
  // fallback
  return { text: raw, isBlank: false };
};

const ReviewAnswerPanel = ({ questions, qResults, title = "Đáp án & Giải thích", defaultOpen = true }: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!questions.length) return null;

  const ansMap: Record<string, ReviewQResult> = {};
  qResults.forEach((r) => { ansMap[r.exam_question_id] = r; });

  const sorted = [...questions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Aggregate stats across all question kinds.
  let correctCount = 0, wrongCount = 0, blankCount = 0;
  sorted.forEach((q) => {
    const r = ansMap[q.id];
    const env = parseEnvelope(r?.user_answer ?? null);
    if (isGapFill(q)) {
      const gaps: Array<{ options: string[]; correct: number }> = q.extra_data?.gaps || [];
      gaps.forEach((g, gi) => {
        if (!g.options || g.options.length === 0) return;
        const pick = env?.answers?.[gi];
        if (pick == null) blankCount++;
        else if (pick === g.correct) correctCount++;
        else wrongCount++;
      });
    } else if (isOpinionMatching(q)) {
      buildOpinionRows(q, env).forEach((row) => {
        if (row.isBlank) blankCount++;
        else if (row.isCorrect) correctCount++;
        else wrongCount++;
      });
    } else if (isLongReading(q)) {
      buildLongReadingRows(q, env).forEach((row) => {
        if (row.isBlank) blankCount++;
        else if (row.isCorrect) correctCount++;
        else wrongCount++;
      });
    } else if (isTextCohesion(q)) {
      // skip from totals — order task, hard to diff cell-by-cell
    } else {
      const userRaw = r?.user_answer ?? null;
      const blank = userRaw == null || userRaw === "";
      if (blank) blankCount++;
      else if (r?.is_correct) correctCount++;
      else wrongCount++;
    }
  });

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#24085a]/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#24085a]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">{title}</p>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              <span className="text-emerald-600 font-medium">Đúng {correctCount}</span>
              <span className="text-destructive font-medium">Sai {wrongCount}</span>
              <span className="text-muted-foreground">Bỏ trống {blankCount}</span>
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {sorted.map((q, idx) => {
            const r = ansMap[q.id];
            const env = parseEnvelope(r?.user_answer ?? null);
            const hasExplanation = !!q.explanation && q.explanation.trim().length > 0;

            // ── Reading Part 1: gap fill inline ─────────────────────────
            if (isGapFill(q)) {
              const { node, stats } = renderGapFillPassage(q, env);
              const allOk = stats.wrong === 0 && stats.blank === 0;
              return (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {stats.blank === stats.total ? (
                        <MinusCircle className="w-5 h-5 text-muted-foreground" />
                      ) : allOk ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Câu {idx + 1} · <span className="text-emerald-600">Đúng {stats.correct}</span> · <span className="text-destructive">Sai {stats.wrong}</span> · Bỏ trống {stats.blank}
                      </p>
                      {node}
                      {hasExplanation && (
                        <div className="mt-3 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                          <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Reading Part 3: opinion matching ────────────────────────
            // ── Reading Part 4: long reading headings ───────────────────
            if (isOpinionMatching(q) || isLongReading(q)) {
              const rows = isOpinionMatching(q) ? buildOpinionRows(q, env) : buildLongReadingRows(q, env);
              const { node, stats } = renderSubTable(rows);
              const allOk = stats.wrong === 0 && stats.blank === 0 && stats.total > 0;
              return (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {stats.blank === stats.total ? (
                        <MinusCircle className="w-5 h-5 text-muted-foreground" />
                      ) : allOk ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Câu {idx + 1} · <span className="text-emerald-600">Đúng {stats.correct}</span> · <span className="text-destructive">Sai {stats.wrong}</span> · Bỏ trống {stats.blank}
                      </p>
                      {node}
                      {hasExplanation && (
                        <div className="mt-3 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                          <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Reading Part 2: text cohesion ───────────────────────────
            if (isTextCohesion(q)) {
              const { node } = renderTextCohesion(q);
              return (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <BookOpen className="w-5 h-5 text-[#24085a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Câu {idx + 1}</p>
                      {node}
                      {hasExplanation && (
                        <div className="mt-3 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                          <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Default MCQ rendering (multiple_choice, vocab_matching) ─
            const userRaw = r?.user_answer ?? null;
            const { text: userText, isBlank } = resolveMcqUserText(userRaw, q.options);
            const ok = !!r?.is_correct && !isBlank;
            const correctText = optionLabel(q.options, q.correct_answer);

            return (
              <div key={q.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isBlank ? (
                      <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    ) : ok ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Câu {idx + 1}</p>
                    {q.question_text && (
                      <p className="text-sm text-foreground mb-2 whitespace-pre-wrap break-words">{q.question_text}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-1 mb-2">
                      <span className="text-xs text-muted-foreground">Bạn:</span>
                      {isBlank ? (
                        <span className={chipBlank}>Bỏ trống</span>
                      ) : ok ? (
                        <span className={chipCorrect}>{userText}</span>
                      ) : (
                        <span className={chipWrong}>{userText}</span>
                      )}
                      {correctText && !ok && (
                        <>
                          <span className="text-xs text-muted-foreground ml-2">Đáp án:</span>
                          <span className={chipCorrect}>{correctText}</span>
                        </>
                      )}
                    </div>

                    {hasExplanation && (
                      <div className="mt-2 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                        <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewAnswerPanel;
