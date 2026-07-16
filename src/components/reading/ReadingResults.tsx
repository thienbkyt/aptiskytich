import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";
import type { ReadingPartType } from "./ReadingExamEngine";

interface ReadingResultsProps {
  correct: number;
  total: number;
  partLabel: string;
  onExit: () => void;
  onRetry: () => void;
  /** When provided, render a "Xem lại từng câu →" button. */
  onReview?: () => void;
  mode?: "fresh" | "history";
  /** When true, render ONLY the per-question detail block (no header card). */
  detailOnly?: boolean;
  /**
   * Tổng số câu của cả ĐỀ Reading (4 part) — dùng để chia điểm /50 theo tỉ lệ.
   * Khi có: điểm part = round(correct/T*50), tối đa = round(total/T*50).
   * Khi không có (mock / không thuộc full test): fallback 2 điểm/câu.
   */
  totalForScore?: number | null;
  // Review data (optional)
  partType?: ReadingPartType;
  part1Question?: ReadingSentenceQuestion;
  part1Answers?: (number | null)[];
  part2Question?: ReadingCohesionQuestion;
  part2Placements?: Record<number, string>[];
  part3Question?: ReadingOpinionQuestion;
  part3Answers?: (number | null)[];
  part4Question?: ReadingLongQuestion;
  part4Answers?: (number | null)[];
}

const ReadingResults = (props: ReadingResultsProps) => {
  const { correct, total, partLabel, onExit, onRetry, onReview, mode = "fresh", detailOnly, totalForScore } = props;
  if (detailOnly) return <ReadingReview {...props} />;
  const T = totalForScore && totalForScore > 0 ? totalForScore : null;
  const score = T ? Math.round((correct / T) * 50) : correct * 2;
  const maxScore = T ? Math.round((total / T) * 50) : total * 2;

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-8 text-center"
      >
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
          Kết quả Reading
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{partLabel}</p>

        <div className="flex items-center justify-center gap-8 mt-4">
          <div>
            <p className="text-4xl font-heading font-extrabold text-primary">{score}/{maxScore}</p>
            <p className="text-sm text-muted-foreground mt-1">Điểm</p>
          </div>
          <div>
            <p className="text-4xl font-heading font-extrabold text-foreground">{correct}/{total}</p>
            <p className="text-sm text-muted-foreground mt-1">Số câu đúng</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Button variant="outline" onClick={onExit} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Button>
          {onReview && (
            <Button variant="secondary" onClick={onReview} className="gap-2">
              <Eye className="w-4 h-4" /> Xem lại từng câu →
            </Button>
          )}
          {mode === "fresh" && (
            <Button onClick={onRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Làm lại
            </Button>
          )}
        </div>
      </motion.div>

      <ReadingReview {...props} />
    </div>
  );
};

const ReadingReview = (props: ReadingResultsProps) => {
  const {
    partType,
    part1Question, part1Answers,
    part2Question, part2Placements,
    part3Question, part3Answers,
    part4Question, part4Answers,
  } = props;

  if (!partType) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-base font-heading font-bold text-foreground mb-4">
        Chi tiết bài làm
      </h3>

      {partType === "part1" && part1Question && (
        <Part1Review q={part1Question} answers={part1Answers || []} />
      )}
      {partType === "part2" && part2Question && (
        <Part2Review q={part2Question} placements={part2Placements || []} />
      )}
      {partType === "part3" && part3Question && (
        <Part3Review q={part3Question} answers={part3Answers || []} />
      )}
      {partType === "part4" && part4Question && (
        <Part4Review q={part4Question} answers={part4Answers || []} />
      )}
    </div>
  );
};

const StatusIcon = ({ ok }: { ok: boolean }) =>
  ok ? (
    <CheckCircle2 className="w-4 h-4 text-success inline-block" />
  ) : (
    <XCircle className="w-4 h-4 text-destructive inline-block" />
  );

const Part1Review = ({ q, answers }: { q: ReadingSentenceQuestion; answers: (number | null)[] }) => {
  const usedGapIdx = [...q.passage.matchAll(/\{(\d+)\}/g)]
    .map((m) => Number(m[1]))
    .filter((idx) => q.gaps[idx]);
  const exampleGapIdx = usedGapIdx[0];

  // Split passage into sentences (keep ending punctuation with each sentence)
  const sentences = q.passage.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);

  const renderGap = (gi: number, key: string) => {
    const gap = q.gaps[gi];
    if (!gap) return null;
    const correctText = gap.options[gap.correct];

    if (gi === exampleGapIdx) {
      return (
        <span
          key={key}
          className="px-2 py-0.5 rounded font-medium border bg-muted text-muted-foreground border-border/50"
        >
          {correctText}
          <span className="ml-1 text-[10px] opacity-70">(cho sẵn)</span>
        </span>
      );
    }

    const userIdx = answers[gi];
    const ok = userIdx === gap.correct;
    const userText = userIdx != null ? gap.options[userIdx] : "(trống)";

    return (
      <span key={key} className="inline-flex flex-wrap items-center gap-1 align-baseline">
        <span
          className={`px-2 py-0.5 rounded font-medium border ${
            ok
              ? "bg-success/10 text-success border-success/30"
              : "bg-destructive/10 text-destructive border-destructive/30 line-through"
          }`}
        >
          {userText}
        </span>
        {!ok && (
          <span className="px-2 py-0.5 rounded font-medium border bg-success/10 text-success border-success/30">
            → {correctText}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground italic">{q.instruction}</p>
      <div className="space-y-3">
        {sentences.map((sentence, sIdx) => {
          const parts = sentence.split(/(\{\d+\})/g);
          return (
            <div key={sIdx} className="text-sm text-foreground leading-7">
              {parts.map((seg, i) => {
                const m = seg.match(/^\{(\d+)\}$/);
                if (!m) return <span key={`${sIdx}-${i}`}>{seg}</span>;
                return renderGap(parseInt(m[1], 10), `${sIdx}-${i}`);
              })}
            </div>
          );
        })}
      </div>
      {q.explanation && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <strong className="text-foreground">Giải thích: </strong>{q.explanation}
        </div>
      )}
    </div>
  );
};

const Part2Review = ({ q, placements }: { q: ReadingCohesionQuestion; placements: Record<number, string>[] }) => {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground italic">{q.instruction}</p>
      {q.sections.map((sec, sIdx) => {
        const p = placements[sIdx] || {};
        // Build ordered correct list
        const sorted = [...sec.sentences].sort((a, b) => a.correctPosition - b.correctPosition);
        return (
          <div key={sIdx} className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Đoạn {sIdx + 1}</p>
            {sorted.map((s) => {
              const userAtPos = p[s.correctPosition];
              const ok = userAtPos === s.text;
              return (
                <div
                  key={s.correctPosition}
                  className={`text-sm rounded-md p-3 border ${
                    ok
                      ? "bg-success/5 border-success/30"
                      : "bg-destructive/5 border-destructive/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <StatusIcon ok={ok} />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Vị trí {s.correctPosition}</p>
                      <p className="text-foreground">{s.text}</p>
                      {!ok && (
                        <p className="text-xs text-destructive mt-1">
                          Bạn xếp: {userAtPos || "(chưa xếp)"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const Part3Review = ({ q, answers }: { q: ReadingOpinionQuestion; answers: (number | null)[] }) => {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground italic">{q.instruction}</p>
      {q.statements.map((s, i) => {
        const userIdx = answers[i];
        const ok = userIdx === s.correctPerson;
        return (
          <div
            key={i}
            className={`text-sm rounded-md p-3 border ${
              ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
            }`}
          >
            <div className="flex items-start gap-2">
              <StatusIcon ok={ok} />
              <div className="flex-1">
                <p className="text-foreground mb-1">
                  <span className="font-medium">Câu {i + 1}:</span> {s.text}
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Bạn ghép: </span>
                  <span className={ok ? "text-success font-medium" : "text-destructive font-medium"}>
                    {userIdx != null ? q.people[userIdx]?.name : "(trống)"}
                  </span>
                  {!ok && (
                    <>
                      {" • "}
                      <span className="text-muted-foreground">Đáp án: </span>
                      <span className="text-success font-medium">{q.people[s.correctPerson]?.name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Part4Review = ({ q, answers }: { q: ReadingLongQuestion; answers: (number | null)[] }) => {
  // Heading-matching format
  if (q.paragraphs && q.headings) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground italic">{q.instruction}</p>
        {q.paragraphs.map((para, pIdx) => {
          const correctHeadingIdx = q.headings!.findIndex((h) => h.paragraphIndex === para.index);
          const userIdx = answers[pIdx];
          const ok = userIdx === correctHeadingIdx;
          return (
            <div
              key={pIdx}
              className={`text-sm rounded-md p-3 border ${
                ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon ok={ok} />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Đoạn {pIdx + 1}</p>
                  <p className="text-foreground text-xs mb-2 line-clamp-3">{para.text}</p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Bạn chọn: </span>
                    <span className={ok ? "text-success font-medium" : "text-destructive font-medium"}>
                      {userIdx != null ? q.headings![userIdx]?.text : "(trống)"}
                    </span>
                    {!ok && (
                      <>
                        {" • "}
                        <span className="text-muted-foreground">Đáp án: </span>
                        <span className="text-success font-medium">
                          {q.headings![correctHeadingIdx]?.text}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // Legacy MCQ format
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground italic">{q.instruction}</p>
      {q.questions.map((qq, i) => {
        const userIdx = answers[i];
        const ok = userIdx === qq.correct;
        return (
          <div
            key={i}
            className={`text-sm rounded-md p-3 border ${
              ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
            }`}
          >
            <div className="flex items-start gap-2">
              <StatusIcon ok={ok} />
              <div className="flex-1">
                <p className="text-foreground mb-2 font-medium">
                  Câu {i + 1}: {qq.text}
                </p>
                <div className="space-y-1">
                  {qq.options.map((opt, oi) => {
                    const isCorrect = oi === qq.correct;
                    const isUser = oi === userIdx;
                    return (
                      <div
                        key={oi}
                        className={`text-xs px-2 py-1 rounded border ${
                          isCorrect
                            ? "border-success/40 bg-success/10 text-foreground"
                            : isUser
                            ? "border-destructive/40 bg-destructive/10 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <span className="font-medium mr-1">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                        {isCorrect && <span className="ml-2 text-success">✓</span>}
                        {isUser && !isCorrect && <span className="ml-2 text-destructive">Bạn chọn</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {q.explanation && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <strong className="text-foreground">Giải thích: </strong>{q.explanation}
        </div>
      )}
    </div>
  );
};

export default ReadingResults;
