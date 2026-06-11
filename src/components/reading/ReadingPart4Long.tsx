import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingLongQuestion } from "@/data/readingQuestions";

interface Props {
  question: ReadingLongQuestion;
  answers: (number | null)[];
  currentIndex: number;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onAnswer: (paragraphIdx: number, headingIdx: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

const ReadingPart4Long = ({
  question, answers, currentIndex, timeLeft, totalTime,
  submitted, onAnswer, onPrevious, onNext, onSubmit,
  isFirst, isLast, sections,
  isBookmarked = false, onToggleBookmark,
}: Props) => {
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
  const headings: { text: string; paragraphIndex: number | null }[] = question.headings || [];
  const allHeadingTexts = headings.map(h => h.text);
  const title = question.title || "";

  const correctMap: Record<number, number> = {};
  paragraphs.forEach((p, pIdx) => {
    const hIdx = headings.findIndex(h => h.paragraphIndex === p.index);
    if (hIdx >= 0) correctMap[pIdx] = hIdx;
  });

  const handleSelect = (paragraphArrayIdx: number, headingIdx: number) => {
    if (submitted) return;
    onAnswer(paragraphArrayIdx, headingIdx);
    setOpenDropdown(null);
  };

  return (
    <div className="min-h-[70vh] flex flex-col pb-20" ref={containerRef}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading Đề 01</p>
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
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
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
          const isCorrect = submitted && selected === correctHeadingIdx;
          const isWrong = submitted && selected !== null && selected !== correctHeadingIdx;

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
                  <button
                    onClick={() => !submitted && setOpenDropdown(openDropdown === pIdx ? null : pIdx)}
                    disabled={submitted}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm text-left transition-all ${
                      submitted
                        ? isCorrect
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : isWrong
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground"
                        : "border-border bg-background text-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    <span className={selected !== null ? "font-medium" : "italic opacity-60"}>
                      {selected !== null ? allHeadingTexts[selected] : "Choose a heading..."}
                    </span>
                    {!submitted && <ChevronDown className="w-4 h-4 shrink-0 ml-2 text-muted-foreground" />}
                    {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 ml-2 text-green-500" />}
                    {submitted && isWrong && <XCircle className="w-4 h-4 shrink-0 ml-2 text-destructive" />}
                  </button>

                  {openDropdown === pIdx && !submitted && (
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
                </div>
              </div>

              {submitted && isWrong && correctHeadingIdx !== undefined && (
                <div className="flex items-center gap-2 mb-3 ml-9">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {allHeadingTexts[correctHeadingIdx]}
                  </span>
                </div>
              )}

              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line pl-9">
                {para.text}
              </div>
            </motion.div>
          );
        })}
      </div>

      {submitted && question.explanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 p-4 rounded-lg bg-muted border border-border"
        >
          <p className="text-sm text-muted-foreground">{question.explanation}</p>
        </motion.div>
      )}

      <BottomNavBar
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={isFirst}
        isLast={isLast}
        submitLabel="Submit"
        sections={sections}
      />
    </div>
  );
};

export default ReadingPart4Long;
