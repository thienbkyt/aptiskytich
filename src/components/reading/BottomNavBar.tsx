import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, List, Info, PersonStanding, LogOut, X, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
}

interface BottomNavBarProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  submitLabel?: string;
  sections?: QuestionSection[];
  bookmarkedCount?: number;
}

const BottomNavBar = ({
  onPrevious, onNext, onSubmit, isFirst, isLast, submitLabel = "Submit",
  sections = [], bookmarkedCount = 0,
}: BottomNavBarProps) => {
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | "bookmarked">("all");

  return (
    <>
      {/* Question List Panel */}
      <AnimatePresence>
        {showQuestionList && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20"
              onClick={() => setShowQuestionList(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-background border-r border-border shadow-xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-heading font-bold text-foreground text-base">Question List</h2>
                <button
                  onClick={() => setShowQuestionList(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 p-4 pb-3">
                <button
                  onClick={() => setListFilter("all")}
                  className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    listFilter === "all"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setListFilter("bookmarked")}
                  className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    listFilter === "bookmarked"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Bookmarked ({bookmarkedCount})
                </button>
              </div>

              {/* Sections */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {listFilter === "all" ? (
                  sections.length > 0 ? (
                    sections.map((section, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          section.onClick?.();
                          setShowQuestionList(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          section.isCurrent
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{section.title}</p>
                        {section.questionCount !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {section.questionCount} Questions
                          </p>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No sections available</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {bookmarkedCount === 0 ? "No bookmarked questions" : `${bookmarkedCount} bookmarked`}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] border-primary bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: icon buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestionList(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <List className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <Info className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <PersonStanding className="w-4 h-4" />
            </button>
          </div>

          {/* Right: navigation */}
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
            {!isFirst && onPrevious && (
              <Button
                variant="outline"
                onClick={onPrevious}
                className="gap-2 border-foreground text-foreground hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </Button>
            )}
            {isLast && onSubmit ? (
              <Button
                onClick={onSubmit}
                className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
              >
                {submitLabel} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : onNext ? (
              <Button
                onClick={onNext}
                className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6"
              >
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomNavBar;
