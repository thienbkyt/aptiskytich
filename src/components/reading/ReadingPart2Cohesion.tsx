import { useMemo, useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, GripVertical, Loader2 } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import AdminExamControls from "@/components/exam/AdminExamControls";
import type { ReadingCohesionQuestion } from "@/data/readingQuestions";
import { part2ItemId, type ReadingReviewData } from "@/lib/readingReview";

interface Props {
  question: ReadingCohesionQuestion;
  placements: Record<number, string>[]; // one map per section: position(1..5) -> sentence text
  onPlacementsChange: (sectionIdx: number, p: Record<number, string>) => void;
  timeLeft?: number;
  totalTime?: number;
  submitted: boolean;
  onSubmit?: () => void;
  onPrevious?: () => void;
  onExitToSections?: () => void;
  sections: any[];
  onSubmitTest?: () => void;
  currentSection?: number;
  onSectionChange?: (idx: number) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  reviewData?: ReadingReviewData | null;
  reviewDataLoading?: boolean;
  pageNumber?: number;
  pageTotal?: number;
}

const ReadingPart2Cohesion = ({
  question, placements, onPlacementsChange,
  timeLeft, totalTime, submitted, onSubmit, onPrevious, sections, onSubmitTest,
  currentSection: currentSectionProp, onSectionChange,
  isBookmarked = false, onToggleBookmark,
  reviewData, reviewDataLoading,
  pageNumber, pageTotal,
}: Props) => {
  const [currentSectionLocal, setCurrentSectionLocal] = useState(0);
  const currentSection = currentSectionProp ?? currentSectionLocal;
  const setCurrentSection = (updater: number | ((p: number) => number)) => {
    const next = typeof updater === "function" ? (updater as (p: number) => number)(currentSection) : updater;
    if (onSectionChange) onSectionChange(next);
    else setCurrentSectionLocal(next);
  };
  const [dragging, setDragging] = useState<string | null>(null);

  const totalSections = question.sections.length;
  const section = question.sections[currentSection];
  const current = placements[currentSection] || {};

  // Sentences already placed (in this section)
  const placedTexts = useMemo(() => new Set(Object.values(current)), [current]);
  const doneForYouText = currentSection === 0
    ? section.sentences.find((s) => s.correctPosition === 1)?.text
    : undefined;
  const unplaced = section.sentences.filter(
    (s) => !placedTexts.has(s.text) && s.text !== doneForYouText
  );

  const correctTextForPosition = (pos: number) =>
    section.sentences.find((s) => s.correctPosition === pos)?.text;

  const handleDragStart = (text: string) => setDragging(text);
  const handleDragEnd = () => setDragging(null);

  const handleDropOnSlot = (pos: number, e: React.DragEvent) => {
    e.preventDefault();
    if (submitted) return;
    const text = e.dataTransfer.getData("text/plain") || dragging;
    if (!text) return;
    const next: Record<number, string> = { ...current };
    // Remove text from any other slot first
    for (const k of Object.keys(next)) {
      if (next[Number(k)] === text) delete next[Number(k)];
    }
    next[pos] = text;
    onPlacementsChange(currentSection, next);
    setDragging(null);
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    if (submitted) return;
    const text = e.dataTransfer.getData("text/plain") || dragging;
    if (!text) return;
    const next: Record<number, string> = { ...current };
    for (const k of Object.keys(next)) {
      if (next[Number(k)] === text) delete next[Number(k)];
    }
    onPlacementsChange(currentSection, next);
    setDragging(null);
  };

  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const goPrevSection = () => setCurrentSection((p) => Math.max(0, p - 1));
  const goNextSection = () => setCurrentSection((p) => Math.min(totalSections - 1, p + 1));

  const isFirst = currentSection === 0;
  const isLast = currentSection === totalSections - 1;

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {!submitted && (
        <AdminExamControls
          label={`Reading Part 2 · Câu ${currentSection + 1}/${totalSections}`}
          onSkip={() => {
            if (!isLast) goNextSection();
            else onSubmit?.();
          }}
          onBack={!isFirst ? goPrevSection : onPrevious}
        />
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading</p>
          <p className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">
            Question {currentSection + 1} of {totalSections}
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
          <TimerDisplay />
        </div>
      </div>

      <p className="text-sm font-semibold text-foreground mb-4">{question.instruction}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto_320px] gap-4 border border-border rounded-lg p-4 bg-card"
        >
          {/* Left: drop zone slots 1..5 */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((pos) => {
              const placed = current[pos];
              const correctText = correctTextForPosition(pos);
              const isCorrect = submitted && placed && placed === correctText;
              const isWrong = submitted && placed && placed !== correctText;
              const slotCls = isCorrect
                ? "border-success bg-success/10"
                : isWrong
                  ? "border-destructive bg-destructive/10"
                  : "border-border";

              // First slot of first section is "done for you" — show the correctPosition=1 sentence read-only
              const isDoneForYou = currentSection === 0 && pos === 1;
              const fixedText = isDoneForYou ? correctTextForPosition(1) : null;

              if (isDoneForYou && fixedText) {
                return (
                  <div
                    key={pos}
                    className="border border-border rounded-md px-4 py-3 bg-muted/40 text-sm text-foreground"
                  >
                    {fixedText}
                  </div>
                );
              }

              return (
                <div
                  key={pos}
                  onDragOver={allowDrop}
                  onDrop={(e) => handleDropOnSlot(pos, e)}
                  className={`min-h-[56px] border-2 border-dashed rounded-md px-4 py-3 text-sm flex items-center transition-colors ${slotCls} ${
                    placed ? "bg-background" : "bg-transparent"
                  }`}
                >
                  {placed ? (
                    <div
                      draggable={!submitted}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", placed);
                        handleDragStart(placed);
                      }}
                      onDragEnd={handleDragEnd}
                      className="flex items-start gap-2 w-full cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-foreground">{placed}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">&nbsp;</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider with arrow */}
          <div className="hidden md:flex items-center">
            <div className="w-px h-full bg-border relative">
              <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-border" />
            </div>
          </div>

          {/* Right: pool of unplaced sentences (or correct order + translations when submitted) */}
          {submitted ? (
            <div className="space-y-3 bg-muted/30 rounded-md p-3 min-h-full">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">Thứ tự đúng &amp; dịch nghĩa</p>
                {reviewDataLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang dịch…
                  </span>
                )}
              </div>
              {[1, 2, 3, 4, 5].map((pos) => {
                const correct = section.sentences.find((s) => s.correctPosition === pos);
                if (!correct) return null;
                const translation = reviewData?.translations?.[part2ItemId(currentSection, pos)];
                return (
                  <div key={pos} className="bg-background border border-border rounded-md px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-primary mt-0.5">{pos}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">{correct.text}</p>
                        {translation ? (
                          <p className="mt-1 text-xs text-muted-foreground">{translation}</p>
                        ) : reviewDataLoading ? (
                          <p className="mt-1 text-xs italic text-muted-foreground">Đang dịch…</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onDragOver={allowDrop}
              onDrop={handleDropOnPool}
              className="space-y-3 bg-muted/30 rounded-md p-3 min-h-full"
            >
              {unplaced.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  All sentences placed.
                </p>
              )}
              {unplaced.map((s) => (
                <div
                  key={s.text}
                  draggable={!submitted}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", s.text);
                    handleDragStart(s.text);
                  }}
                  onDragEnd={handleDragEnd}
                  className="bg-background border border-border rounded-md px-3 py-3 text-sm text-foreground cursor-grab active:cursor-grabbing flex items-start gap-2"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <BottomNavBar
        onPrevious={!isFirst ? goPrevSection : onPrevious}
        onNext={!isLast ? goNextSection : (!submitted ? onSubmit : undefined)}
        onSubmit={undefined}
        isFirst={false}
        isLast={false}
        sections={sections}
        onSubmitTest={onSubmitTest}
      />
    </div>
  );
};

export default memo(ReadingPart2Cohesion);
