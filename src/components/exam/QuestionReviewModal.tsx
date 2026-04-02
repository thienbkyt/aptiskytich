import { useState } from "react";
import { Plus, Minus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ReviewPart {
  label: string;
  seen: boolean;
  attempted: boolean;
  onClick?: () => void;
}

export interface ReviewQuestion {
  label: string;
  parts?: ReviewPart[];
  seen?: boolean;
  attempted?: boolean;
  onClick?: () => void;
}

export interface ReviewSkill {
  label: string;
  questionCount: number;
  questions: ReviewQuestion[];
}

export interface QuestionReviewData {
  skills: ReviewSkill[];
}

interface QuestionReviewModalProps {
  data: QuestionReviewData;
  onClose: () => void;
  onSubmit: () => void;
}

const QuestionReviewModal = ({ data, onClose, onSubmit }: QuestionReviewModalProps) => {
  const [expandedSkills, setExpandedSkills] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleSkill = (i: number) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleQuestion = (key: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
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
          <div className="p-6 pb-2">
            <h2 className="text-lg font-bold text-gray-900">Question Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">Please review the following questions</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {data.skills.map((skill, si) => (
              <div key={si} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Skill row */}
                <button
                  onClick={() => toggleSkill(si)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">{skill.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{skill.questionCount} Questions</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#24085a]/10 flex items-center justify-center shrink-0">
                    {expandedSkills.has(si) ? (
                      <Minus className="w-4 h-4 text-[#24085a]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#24085a]" />
                    )}
                  </div>
                </button>

                {/* Questions (Level 2) */}
                <AnimatePresence>
                  {expandedSkills.has(si) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {skill.questions.map((q, qi) => {
                          const qKey = `${si}-${qi}`;
                          const hasParts = q.parts && q.parts.length > 0;

                          return (
                            <div key={qi} className="border border-gray-100 rounded-lg bg-gray-50/80 overflow-hidden">
                              <button
                                onClick={() => {
                                  if (hasParts) {
                                    toggleQuestion(qKey);
                                  } else {
                                    q.onClick?.();
                                    onClose();
                                  }
                                }}
                                className="w-full flex items-center justify-between p-3 hover:bg-gray-100/50 transition-colors"
                              >
                                <div className="text-left">
                                  <p className="font-bold text-gray-900 text-sm">{q.label}</p>
                                  {hasParts ? (
                                    <p className="text-xs text-gray-500 mt-0.5">{q.parts!.length} Parts</p>
                                  ) : (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {q.seen ? "Seen" : "Unseen"}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!hasParts && (
                                    <span className={`text-xs font-medium ${q.attempted ? "text-[#24085a]" : "text-gray-400"}`}>
                                      {q.attempted ? "Attempted" : "Not Attempted"}
                                    </span>
                                  )}
                                  {hasParts && (
                                    <div className="w-7 h-7 rounded-lg bg-[#24085a]/10 flex items-center justify-center">
                                      {expandedQuestions.has(qKey) ? (
                                        <Minus className="w-3.5 h-3.5 text-[#24085a]" />
                                      ) : (
                                        <Plus className="w-3.5 h-3.5 text-[#24085a]" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>

                              {/* Parts (Level 3) */}
                              <AnimatePresence>
                                {hasParts && expandedQuestions.has(qKey) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3 pb-3 space-y-1.5">
                                      {q.parts!.map((part, pi) => (
                                        <button
                                          key={pi}
                                          onClick={() => {
                                            part.onClick?.();
                                            onClose();
                                          }}
                                          className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                                        >
                                          <div className="text-left">
                                            <p className="font-bold text-gray-900 text-sm">{part.label}</p>
                                            <p className="text-xs text-gray-400">
                                              {part.seen ? "Seen" : "Unseen"}
                                            </p>
                                          </div>
                                          <span className={`text-xs font-medium ${part.attempted ? "text-[#24085a]" : "text-gray-400"}`}>
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
            ))}
          </div>

          {/* Footer buttons */}
          <div className="p-6 pt-4 space-y-3">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#24085a] text-white font-semibold text-sm hover:bg-[#1a0640] transition-colors"
            >
              Review Questions
            </button>
            <button
              onClick={onSubmit}
              className="w-full py-3 rounded-xl bg-white border border-gray-300 text-gray-900 font-semibold text-sm hover:bg-gray-50 transition-colors"
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
