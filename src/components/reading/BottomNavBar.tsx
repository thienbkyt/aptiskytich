import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, List, Info, PersonStanding, LogOut, X, Plus, Minus, Bookmark } from "lucide-react";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import britishCouncilLogo from "@/assets/british-council-aptis-logo.webp";

export interface QuestionItem {
  label: string;
  seen: boolean;
  attempted: boolean;
  bookmarked?: boolean;
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
  /** Optional override; otherwise auto-computed from sections[].questions[].bookmarked */
  bookmarkedCount?: number;
  /** True while showing instructions/intro screens — Exit button opens "Proceed to next section?" dialog */
  isInstructionsPhase?: boolean;
  /** Called from "Proceed" in the instructions dialog */
  onProceedFromInstructions?: () => void;
  /** Called when user confirms "Submit test" in the Exit submission flow */
  onSubmitTest?: () => void;
  reviewScopeNote?: string;
}

const BottomNavBar = ({
  onPrevious, onNext, onSubmit, isFirst, isLast, submitLabel = "Submit",
  sections = [], bookmarkedCount,
  isInstructionsPhase = false, onProceedFromInstructions, onSubmitTest,
  reviewScopeNote,
}: BottomNavBarProps) => {
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | "bookmarked">("all");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [magnification, setMagnification] = useState(100);
  useEffect(() => {
    return () => { document.documentElement.style.fontSize = ""; };
  }, []);
  const [showProceedDialog, setShowProceedDialog] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState<Set<number>>(new Set());
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const navLockUntil = useRef(0);

  const runNavLocked = (action?: () => void) => {
    if (!action) return;
    const now = Date.now();
    if (now < navLockUntil.current) return;
    navLockUntil.current = now + 150;
    action();
  };

  const autoBookmarkedCount = useMemo(
    () => sections.reduce((acc, sec) => acc + (sec.questions?.filter((q) => q.bookmarked).length || 0), 0),
    [sections],
  );
  const effectiveBookmarkedCount = bookmarkedCount ?? autoBookmarkedCount;

  const skillName = useMemo(() => {
    const t = sections[0]?.title;
    if (!t) return "";
    return t.replace(/^Aptis\s+General\s+/i, "").replace(/\s+Instructions$/i, "").trim();
  }, [sections]);

  const bookmarkedFlat = useMemo(
    () =>
      sections.flatMap((sec) =>
        (sec.questions || [])
          .map((q, qi) => ({ q, qi, sectionTitle: sec.title }))
          .filter((x) => x.q.bookmarked),
      ),
    [sections],
  );

  // Sections containing only the unanswered questions (preserves original section indices)
  const unansweredBySection = useMemo(
    () =>
      sections
        .map((sec, sIdx) => ({
          sIdx,
          title: sec.title,
          questions: (sec.questions || []).filter((q) => !q.attempted),
        }))
        .filter((s) => s.questions.length > 0),
    [sections],
  );
  const totalUnanswered = useMemo(
    () => unansweredBySection.reduce((a, s) => a + s.questions.length, 0),
    [unansweredBySection],
  );

  const toggleReviewSection = (index: number) => {
    setReviewExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleExitClick = () => {
    if (isInstructionsPhase) {
      setShowProceedDialog(true);
      return;
    }
    if (totalUnanswered === 0) {
      setShowSubmitConfirm(true);
    } else {
      // Default-expand all sections that have unanswered questions
      setReviewExpanded(new Set(unansweredBySection.map((s) => s.sIdx)));
      setShowReviewModal(true);
    }
  };

  const jumpToFirstUnanswered = () => {
    const first = unansweredBySection[0]?.questions[0];
    setShowReviewModal(false);
    first?.onClick?.();
  };

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
                  aria-label="Đóng danh sách câu hỏi"
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
                  Bookmarked ({effectiveBookmarkedCount})
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
                                
                                setShowQuestionList(false);
                              } else {
                                toggleSection(i);
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
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-foreground">{q.label}</p>
                                      {q.bookmarked && (
                                        <Bookmark className="w-3.5 h-3.5 text-primary fill-primary" />
                                      )}
                                    </div>
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
                  bookmarkedFlat.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No bookmarked questions</p>
                  ) : (
                    <div className="space-y-1">
                      {bookmarkedFlat.map(({ q, qi, sectionTitle }, idx) => (
                        <button
                          key={`${sectionTitle}-${qi}-${idx}`}
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
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-foreground">{q.label}</p>
                            <Bookmark className="w-3.5 h-3.5 text-primary fill-primary" />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-muted-foreground">{sectionTitle}</span>
                            <span className={`text-xs font-medium ${q.attempted ? "text-primary" : "text-muted-foreground"}`}>
                              {q.attempted ? "Attempted" : "Not Attempted"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
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
                  aria-label="Đóng thông tin"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <img src={britishCouncilLogo} alt="British Council Aptis" className="h-28 object-contain" />
                <div className="border-l-4 border-primary/30 pl-3">
                  <p className="text-sm font-medium text-foreground">{skillName} Practice Test</p>
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
                  aria-label="Đóng tuỳ chỉnh hỗ trợ truy cập"
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
                      aria-label="Giảm kích thước chữ"
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustMagnification(10)}
                      aria-label="Tăng kích thước chữ"
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
      <div className="exam-light-bottom-bar fixed bottom-0 left-0 right-0 z-40 border-t-[3px] bg-background/95 backdrop-blur-sm border-[#230859]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestionList(true)}
              aria-label="Mở danh sách câu hỏi"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowInfo(true)}
              aria-label="Xem thông tin bài thi"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAccessibility(true)}
              aria-label="Mở tuỳ chỉnh hỗ trợ truy cập"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <PersonStanding className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExitClick}
              aria-label="Thoát bài thi"
              className="exam-nav-prev-next w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
            {!isFirst && onPrevious && (
              <Button variant="outline" onClick={() => runNavLocked(onPrevious)} className="exam-nav-prev-next exam-nav-previous-button gap-2">
                <ArrowLeft className="w-4 h-4" /> Previous
              </Button>
            )}
            {isLast && onSubmit ? (
              <Button onClick={() => runNavLocked(onSubmit)} className="exam-nav-submit exam-nav-next-button gap-2 px-6">
                {submitLabel} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : onNext ? (
              <Button onClick={() => runNavLocked(onNext)} className="exam-nav-prev-next exam-nav-next-button gap-2 px-6">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Proceed-to-next-section dialog (instructions phase) */}
      {showProceedDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowProceedDialog(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Proceed to the next section?</h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              The current section is timed and will be locked if you proceed. Please ensure you have reviewed each of your responses.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowProceedDialog(false)}
                className="px-6 py-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => { setShowProceedDialog(false); onProceedFromInstructions?.(); }}
                className="px-6 py-2.5 rounded-lg bg-[#24085a] hover:bg-[#1a0640] text-white text-sm font-semibold transition-colors"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Review modal (unanswered questions) */}
      {showReviewModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReviewModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Question Review</h2>
              <p className="text-sm text-gray-500 mt-1">Please review the following questions</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-3">
              {unansweredBySection.map(({ sIdx, title, questions }) => {
                const skill = title.split(" ")[2] || title;
                const expanded = reviewExpanded.has(sIdx);
                return (
                  <div key={sIdx} className="border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{skill}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{questions.length} Questions</p>
                      </div>
                      <button
                        onClick={() => toggleReviewSection(sIdx)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                        aria-label={expanded ? "Thu gọn" : "Mở rộng"}
                      >
                        {expanded ? <Minus className="w-3.5 h-3.5 text-gray-700" /> : <Plus className="w-3.5 h-3.5 text-[#24085a]" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2">
                            {questions.map((q, qi) => (
                              <button
                                key={qi}
                                onClick={() => { setShowReviewModal(false); q.onClick?.(); }}
                                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-[#24085a]/40 hover:bg-gray-50 transition-colors"
                              >
                                <p className="text-sm font-bold text-gray-900">{q.label}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-500">{q.seen ? "Seen" : "Unseen"}</span>
                                  <span className="text-xs text-gray-500">Not Attempted</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            <div className="p-6 pt-4 space-y-2">
              <button
                type="button"
                onClick={jumpToFirstUnanswered}
                className="w-full px-6 py-3 rounded-lg bg-[#24085a] hover:bg-[#1a0640] text-white text-sm font-semibold transition-colors"
              >
                Review Questions
              </button>
              <button
                type="button"
                onClick={() => { setShowReviewModal(false); setShowSubmitConfirm(true); }}
                className="w-full px-6 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <ExamFinishScreen
          onSubmit={() => { setShowSubmitConfirm(false); onSubmitTest?.(); }}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}
    </>
  );
};

export default BottomNavBar;
