import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingOpinionQuestion } from "@/data/readingQuestions";

interface Props {
  question: ReadingOpinionQuestion;
  answers: (number | null)[];
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  currentStatement: number;
  onAnswer: (statementIndex: number, personIndex: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  sections: any[];
}

const ReadingPart3Opinion = ({
  question, answers, timeLeft, totalTime, submitted, currentStatement,
  onAnswer, onPrevious, onNext, onSubmit, isFirst, isLast, sections,
}: Props) => {
  const [bookmarked, setBookmarked] = useState(false);

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading – Part 3</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              bookmarked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
            Bookmark
          </button>
          <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
        </div>
      </div>

      {/* Instruction */}
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{question.instruction}</p>

      {/* People's opinions - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {question.people.map((person, pi) => (
          <div key={pi} className="bg-white border border-border rounded-xl p-4 shadow-sm">
            <p className="text-sm font-heading font-bold text-foreground mb-2">{person.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{person.text}</p>
          </div>
        ))}
      </div>

      {/* All statements with dropdowns */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        {question.statements.map((stmt, si) => {
          const selected = answers[si];
          const isCorrect = submitted && selected === stmt.correctPerson;
          const isWrong = submitted && selected !== null && selected !== stmt.correctPerson;

          return (
            <div key={si} className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-foreground min-w-0 flex-1">
                <span className="font-bold mr-1">{si + 1}.</span>
                {stmt.text}
              </span>

              <div className="relative shrink-0">
                <select
                  value={selected !== null && selected !== undefined ? selected : ""}
                  onChange={(e) => {
                    if (submitted) return;
                    const val = e.target.value;
                    if (val !== "") onAnswer(si, Number(val));
                  }}
                  disabled={submitted}
                  className={`appearance-none rounded-lg border-2 px-3 py-2 pr-8 text-sm font-medium min-w-[140px] bg-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    submitted
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

              {submitted && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
              {submitted && isWrong && (
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
      {submitted && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200"
        >
          <p className="text-sm text-blue-800">{question.explanation}</p>
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

export default ReadingPart3Opinion;
