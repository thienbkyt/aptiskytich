import { memo } from "react";
import { motion } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle, ChevronDown, Loader2 } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingOpinionQuestion } from "@/data/readingQuestions";
import { personLetterToIndex, type ReadingReviewData } from "@/lib/readingReview";

interface Props {
  question: ReadingOpinionQuestion;
  answers: (number | null)[];
  timeLeft?: number;
  totalTime?: number;
  submitted: boolean;
  revealAnswers?: boolean;
  currentStatement: number;
  onAnswer: (statementIndex: number, personIndex: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
  onSubmitTest?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  reviewData?: ReadingReviewData | null;
  reviewDataLoading?: boolean;
  pageNumber?: number;
  pageTotal?: number;
  hideTimer?: boolean;
  /** Marathon: per-statement locked/graded set. */
  lockedIndices?: Set<number>;
  /** Marathon: hide the BottomNavBar. */
  hideBottomNav?: boolean;
}

const ReadingPart3Opinion = ({
  question, answers, timeLeft, totalTime, submitted, revealAnswers, currentStatement,
  onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections, onSubmitTest,
  isBookmarked = false, onToggleBookmark,
  reviewData, reviewDataLoading,
  pageNumber, pageTotal, hideTimer = false,
  lockedIndices, hideBottomNav = false,
}: Props) => {
  const globallyRevealed = submitted || !!revealAnswers;
  const revealFor = (si: number) => globallyRevealed || (lockedIndices?.has(si) ?? false);
  const reveal = globallyRevealed || (lockedIndices && lockedIndices.size > 0);

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading</p>
          {pageNumber !== undefined && pageTotal !== undefined && (
            <p className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
              Question {pageNumber} of {pageTotal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              isBookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          {!hideTimer && <TimerDisplay />}
        </div>
      </div>

      {/* Instruction */}
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{question.instruction}</p>

      {reveal && reviewDataLoading && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm câu dẫn chứng…
        </p>
      )}

      {/* People's opinions - plain text paragraphs like real exam */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 space-y-5">
        {question.people.map((person, pi) => {
          // Collect evidence sentences in this person's block (from AI), then render
          // the block text with each occurrence wrapped in a highlight.
          const evidences: Array<{ num: number; sentence: string }> = [];
          if (reveal && reviewData?.part3Evidence) {
            Object.entries(reviewData.part3Evidence).forEach(([qi, ev]) => {
              if (!ev?.sentence || !ev?.person) return;
              if (personLetterToIndex(ev.person) === pi && person.text.includes(ev.sentence)) {
                if (!evidences.some((e) => e.sentence === ev.sentence)) {
                  evidences.push({ num: Number(qi) + 1, sentence: ev.sentence });
                }
              }
            });
          }
          const renderText = () => {
            if (evidences.length === 0) {
              return <span className="whitespace-pre-line">{person.text}</span>;
            }
            // Split iteratively on each evidence sentence
            const parts: Array<{ t: string; hl: boolean; num?: number }> = [{ t: person.text, hl: false }];
            evidences.forEach(({ num, sentence }) => {
              const next: Array<{ t: string; hl: boolean; num?: number }> = [];
              parts.forEach((p) => {
                if (p.hl) { next.push(p); return; }
                const segs = p.t.split(sentence);
                segs.forEach((s, i) => {
                  if (s) next.push({ t: s, hl: false });
                  if (i < segs.length - 1) next.push({ t: sentence, hl: true, num });
                });
              });
              parts.splice(0, parts.length, ...next);
            });
            return (
              <span className="whitespace-pre-line">
                {parts.map((p, i) =>
                  p.hl ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5">
                      <span className="font-bold mr-1">{p.num}.</span>
                      {p.t}
                    </mark>
                  ) : (
                    <span key={i}>{p.t}</span>
                  ),
                )}
              </span>
            );
          };
          return (
            <div key={pi}>
              <p className="text-sm font-bold text-foreground mb-1">{person.name}</p>
              <p className="text-sm text-foreground leading-relaxed">{renderText()}</p>
            </div>
          );
        })}
      </div>

      {/* All statements with dropdowns */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        {question.statements.map((stmt, si) => {
          const selected = answers[si];
          const revealHere = revealFor(si);
          const lockedHere = submitted || (lockedIndices?.has(si) ?? false);
          const isCorrect = revealHere && selected === stmt.correctPerson;
          const isWrong = revealHere && selected !== null && selected !== stmt.correctPerson;

          return (
            <div key={si} data-question-index={si} className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-foreground min-w-0 flex-1">
                <span className="font-bold mr-1">{si + 1}.</span>
                {stmt.text}
              </span>

              <div className="relative shrink-0">
                <select
                  value={selected !== null && selected !== undefined ? selected : ""}
                  onChange={(e) => {
                    if (lockedHere) return;
                    const val = e.target.value;
                    if (val !== "") onAnswer(si, Number(val));
                  }}
                  disabled={lockedHere}
                  className={`appearance-none rounded-lg border-2 px-3 py-2 pr-8 text-sm font-medium min-w-[140px] bg-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    revealHere
                      ? isCorrect
                        ? "border-green-500 bg-green-50 text-green-700"
                        : isWrong
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-border text-muted-foreground"
                      : selected !== null && selected !== undefined
                        ? "border-[#24085a] bg-[#24085a]/5 text-[#24085a]"
                        : "border-border text-muted-foreground hover:border-[#24085a]/40"
                  }`}
                >
                  <option value="">—</option>
                  {question.people.map((person, pi) => (
                    <option key={pi} value={pi}>{person.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>

              {revealHere && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
              {revealHere && selected !== stmt.correctPerson && (
                <div className="flex items-center gap-1 shrink-0">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-xs text-green-600 font-medium">
                    → {question.people[stmt.correctPerson]?.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation after submit */}
      {reveal && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200"
        >
          <p className="text-sm text-blue-800 whitespace-pre-line">{question.explanation}</p>
        </motion.div>
      )}

      {!hideBottomNav && (
        <BottomNavBar
          onPrevious={onPrevious}
          onNext={onNext}
          onSubmit={onSubmit}
          isFirst={isFirst}
          isLast={isLast}
          submitLabel="Submit"
          sections={sections}
          onSubmitTest={onSubmitTest}
        />
      )}
    </div>
  );
};

export default memo(ReadingPart3Opinion);
