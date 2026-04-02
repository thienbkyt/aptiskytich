import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, List, Info, PersonStanding, LogOut, X, Plus, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import britishCouncilLogo from "@/assets/british-council-aptis-logo.png";

export interface QuestionItem {
  label: string;
  seen: boolean;
  attempted: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
}

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
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
  const [showInfo, setShowInfo] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | "bookmarked">("all");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [magnification, setMagnification] = useState(100);
  const { resolvedTheme, setTheme } = useTheme();

  const isDarkMode = resolvedTheme === "dark";

  const toggleDarkMode = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  const adjustMagnification = (delta: number) => {
    setMagnification(prev => {
      const next = Math.min(200, Math.max(50, prev + delta));
      document.documentElement.style.fontSize = `${next}%`;
      return next;
    });
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <>
      {/* Question List Panel */}
      <AnimatePresence>
        {showQuestionList && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20"
              onClick={() => setShowQuestionList(false)}
            />
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
                      <div key={i}>
                        {/* Section header */}
                        <div
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            section.isCurrent
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30 hover:bg-muted/50"
                          }`}
                        >
                          <button
                            onClick={() => {
                              if (!section.questions?.length) {
                                section.onClick?.();
                                setShowQuestionList(false);
                              }
                            }}
                            className="w-full text-left"
                          >
                            <p className="text-sm font-medium text-foreground">{section.title}</p>
                          </button>
                          {section.questionCount !== undefined && section.questions?.length && (
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-muted-foreground">
                                {section.questionCount} Questions
                              </p>
                              <button
                                onClick={() => toggleSection(i)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-muted/80 transition-colors"
                              >
                                {expandedSections.has(i) ? (
                                  <Minus className="w-3.5 h-3.5 text-foreground" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-primary" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded questions */}
                        <AnimatePresence>
                          {expandedSections.has(i) && section.questions && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1 space-y-1">
                                {section.questions.map((q, qi) => (
                                  <button
                                    key={qi}
                                    onClick={() => {
                                      q.onClick?.();
                                      setShowQuestionList(false);
                                    }}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                      q.isCurrent
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                                    }`}
                                  >
                                    <p className="text-sm font-bold text-foreground">{q.label}</p>
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className="text-xs text-muted-foreground">
                                        {q.seen ? "Seen" : "Unseen"}
                                      </span>
                                      <span className={`text-xs font-medium ${q.attempted ? "text-primary" : "text-muted-foreground"}`}>
                                        {q.attempted ? "Attempted" : "Not Attempted"}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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

      {/* Information Panel */}
      <AnimatePresence>
        {showInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20"
              onClick={() => setShowInfo(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-background border-r border-border shadow-xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-heading font-bold text-foreground text-base">Information</h2>
                <button
                  onClick={() => setShowInfo(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <img src={britishCouncilLogo} alt="British Council Aptis" className="h-28 object-contain" />
                <div className="border-l-4 border-primary/30 pl-3">
                  <p className="text-sm font-medium text-foreground">Reading Practice Test Version 001</p>
                </div>
                <div className="border-l-4 border-primary/30 pl-3">
                  <p className="text-sm font-bold text-foreground">Description</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Aptis General Practice Test</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Accessibility Panel */}
      <AnimatePresence>
        {showAccessibility && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20"
              onClick={() => setShowAccessibility(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-background border-r border-border shadow-xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-heading font-bold text-foreground text-base">Accessibility</h2>
                <button
                  onClick={() => setShowAccessibility(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {/* Dark Mode */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-border">
                  <span className="text-sm font-medium text-foreground">Dark Mode</span>
                  <button
                    onClick={toggleDarkMode}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      isDarkMode ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow transition-transform ${
                        isDarkMode ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Magnification */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-border">
                  <span className="text-sm font-medium text-foreground">Magnification</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustMagnification(-10)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustMagnification(10)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t-[3px] bg-background/95 backdrop-blur-sm border-[#230859]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestionList(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowInfo(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAccessibility(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <PersonStanding className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
            {!isFirst && onPrevious && (
              <Button variant="outline" onClick={onPrevious} className="gap-2 border-foreground text-foreground hover:bg-muted">
                <ArrowLeft className="w-4 h-4" /> Previous
              </Button>
            )}
            {isLast && onSubmit ? (
              <Button onClick={onSubmit} className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6">
                {submitLabel} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : onNext ? (
              <Button onClick={onNext} className="bg-foreground text-background hover:bg-foreground/90 gap-2 px-6">
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
