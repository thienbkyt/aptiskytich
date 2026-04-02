import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ReviewPart {
  label: string;
  seen: boolean;
  attempted: boolean;
  onClick?: () => void;
}

export interface ReviewQuestion {
  label: string;
  parts: ReviewPart[];
}

export interface ReviewSkill {
  skill: string;
  totalQuestions: number;
  questions: ReviewQuestion[];
}

interface QuestionReviewModalProps {
  open: boolean;
  skills: ReviewSkill[];
  onClose: () => void;
  onSubmit: () => void;
}

const QuestionReviewModal = ({ open, skills, onClose, onSubmit }: QuestionReviewModalProps) => {
  const [expandedSkills, setExpandedSkills] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  if (!open) return null;

  const toggleSkill = (i: number) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleQuestion = (key: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-xl font-bold text-gray-900">Question Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">Please review the following questions</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {skills.map((skill, si) => {
              const skillExpanded = expandedSkills.has(si);

              return (
                <div key={si} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Skill row */}
                  <button
                    onClick={() => toggleSkill(si)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-base font-bold text-gray-900">{skill.skill}</p>
                      <p className="text-sm text-gray-500">{skill.totalQuestions} Questions</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-[#24085a]/10 flex items-center justify-center shrink-0">
                      {skillExpanded ? (
                        <Minus className="w-4 h-4 text-[#24085a]" />
                      ) : (
                        <Plus className="w-4 h-4 text-[#24085a]" />
                      )}
                    </div>
                  </button>

                  {/* Questions (Tier 2) */}
                  <AnimatePresence>
                    {skillExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2">
                          {skill.questions.map((q, qi) => {
                            const qKey = `${si}-${qi}`;
                            const qExpanded = expandedQuestions.has(qKey);
                            const allAttempted = q.parts.every(p => p.attempted);
                            const anyUnseen = q.parts.some(p => !p.seen);

                            return (
                              <div key={qi} className="border border-gray-200 rounded-lg overflow-hidden">
                                {/* Question row */}
                                <button
                                  onClick={() => toggleQuestion(qKey)}
                                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                                    qExpanded ? "border-b border-gray-100" : ""
                                  }`}
                                >
                                  <div className="text-left">
                                    <p className="text-sm font-bold text-gray-900">{q.label}</p>
                                    <p className="text-xs text-gray-500">{q.parts.length} Parts</p>
                                  </div>
                                  {q.parts.length > 0 ? (
                                    <div className="w-7 h-7 rounded-lg bg-[#24085a]/10 flex items-center justify-center shrink-0">
                                      {qExpanded ? (
                                        <Minus className="w-3.5 h-3.5 text-[#24085a]" />
                                      ) : (
                                        <Plus className="w-3.5 h-3.5 text-[#24085a]" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-4">
                                      <span className="text-xs text-gray-400">
                                        {anyUnseen ? "Unseen" : "Seen"}
                                      </span>
                                      <span className={`text-xs font-medium ${allAttempted ? "text-gray-900" : "text-gray-400"}`}>
                                        {allAttempted ? "Attempted" : "Not Attempted"}
                                      </span>
                                    </div>
                                  )}
                                </button>

                                {/* Parts (Tier 3) */}
                                <AnimatePresence>
                                  {qExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-3 pb-2 space-y-1">
                                        {q.parts.map((part, pi) => (
                                          <button
                                            key={pi}
                                            onClick={() => {
                                              part.onClick?.();
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                                          >
                                            <div className="text-left">
                                              <p className="text-sm font-bold text-gray-900">{part.label}</p>
                                              <p className="text-xs text-gray-400">
                                                {part.seen ? "Seen" : "Unseen"}
                                              </p>
                                            </div>
                                            <span className={`text-xs font-medium ${part.attempted ? "text-gray-900" : "text-gray-400"}`}>
                                              {part.attempted ? "Attempted" : "Not Attempted"}
                                            </span>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Footer buttons */}
          <div className="px-6 pb-6 pt-2 space-y-3">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-[#24085a] text-white font-semibold text-sm hover:bg-[#1a0640] transition-colors"
            >
              Review Questions
            </button>
            <button
              onClick={onSubmit}
              className="w-full py-3.5 rounded-xl bg-white border border-gray-300 text-gray-900 font-semibold text-sm hover:bg-gray-50 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default QuestionReviewModal;
