import { useEffect, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle, ChevronDown, Loader2 } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingLongQuestion } from "@/data/readingQuestions";
import { part4ItemId, type ReadingReviewData } from "@/lib/readingReview";

interface Props {
  question: ReadingLongQuestion;
  answers: (number | null)[];
  currentIndex: number;
  timeLeft?: number;
  totalTime?: number;
  submitted: boolean;
  revealAnswers?: boolean;
  onAnswer: (paragraphIdx: number, headingIdx: number) => void;
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
  hideTimer?: boolean;
  /** Marathon: per-paragraph locked/graded set. */
  lockedIndices?: Set<number>;
  /** Marathon: hide the BottomNavBar. */
  hideBottomNav?: boolean;
}

const ReadingPart4Long = ({
  question, answers, currentIndex, timeLeft, totalTime,
  submitted, revealAnswers, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections, onSubmitTest,
  isBookmarked = false, onToggleBookmark,
  reviewData, reviewDataLoading, hideTimer = false,
  lockedIndices, hideBottomNav = false,
}: Props) => {
  const globallyRevealed = submitted || !!revealAnswers;
  const revealFor = (pIdx: number) => globallyRevealed || (lockedIndices?.has(pIdx) ?? false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (openDropdown === null) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  const paragraphs: { index: number; text: string }[] = question.paragraphs || [];
  const explByPara = (question.explanation || "")
    .replace(/^---.*?---\s*/, "")
    .split(/\n(?=\d+\.\s)/)
    .map((s) => s.replace(/^\d+\.\s*/, "").trim());
  const headings: { text: string; paragraphIndex: number | null }[] = question.headings || [];
  const allHeadingTexts = headings.map(h => h.text);
  const title = question.title || "";

  const correctMap: Record<number, number> = {};
  paragraphs.forEach((p, pIdx) => {
    const hIdx = headings.findIndex(h => h.paragraphIndex === p.index);
    if (hIdx >= 0) correctMap[pIdx] = hIdx;
  });

  const handleSelect = (paragraphArrayIdx: number, headingIdx: number) => {
    if (revealFor(paragraphArrayIdx)) return;
    onAnswer(paragraphArrayIdx, headingIdx);
    setOpenDropdown(null);
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20" ref={containerRef}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading</p>
          <p className="text-sm text-muted-foreground">
            {paragraphs.length} paragraphs · {allHeadingTexts.length} headings
          </p>
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

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-foreground">{question.instruction}</p>
      </div>

      {title && (
        <h2 className="text-2xl font-bold text-foreground mb-6">{title}</h2>
      )}

      <div className="space-y-6">
        {paragraphs.map((para, pIdx) => {
          const selected = answers[pIdx];
          const correctHeadingIdx = correctMap[pIdx];
          const isCorrect = reveal && selected === correctHeadingIdx;
          const isWrong = reveal && selected !== null && selected !== correctHeadingIdx;

          return (
            <motion.div
              key={pIdx}
              data-question-index={pIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pIdx * 0.05 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold text-foreground min-w-[24px]">{para.index}.</span>
                <div className="relative flex-1 max-w-sm">
                  {reveal ? (
                    <div
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
                        isCorrect
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : isWrong
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      <span className={selected !== null ? "font-medium" : "italic opacity-60"}>
                        {selected !== null ? allHeadingTexts[selected] : "—"}
                      </span>
                      {isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 ml-2 text-green-500" />}
                      {isWrong && <XCircle className="w-4 h-4 shrink-0 ml-2 text-destructive" />}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === pIdx ? null : pIdx)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm text-left transition-all border-border bg-background text-foreground hover:border-muted-foreground/50"
                      >
                        <span className={selected !== null ? "font-medium" : "italic opacity-60"}>
                          {selected !== null ? allHeadingTexts[selected] : "Choose a heading..."}
                        </span>
                        <ChevronDown className="w-4 h-4 shrink-0 ml-2 text-muted-foreground" />
                      </button>
                      {openDropdown === pIdx && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-y-visible">
                          {allHeadingTexts.map((heading, hIdx) => (
                            <button
                              key={hIdx}
                              onClick={() => handleSelect(pIdx, hIdx)}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                selected === hIdx
                                  ? "bg-muted font-medium text-foreground"
                                  : "hover:bg-muted text-foreground"
                              }`}
                            >
                              {heading}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {reveal && selected !== correctHeadingIdx && correctHeadingIdx !== undefined && (
                <div className="flex flex-wrap items-center gap-2 mb-3 ml-9">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {allHeadingTexts[correctHeadingIdx]}
                  </span>
                  {(() => {
                    const tr = reviewData?.translations?.[part4ItemId(correctHeadingIdx)];
                    if (tr) {
                      return (
                        <span className="text-xs text-muted-foreground">: {tr}</span>
                      );
                    }
                    if (reviewDataLoading) {
                      return (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> đang dịch…
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {reveal && explByPara[pIdx] && (
                <div className="text-sm text-blue-800 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 rounded-lg p-3 mb-3 ml-9 whitespace-pre-line">
                  {explByPara[pIdx]}
                </div>
              )}
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line pl-9">
                {para.text}
              </div>
            </motion.div>
          );
        })}
      </div>


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
    </div>
  );
};

export default memo(ReadingPart4Long);
