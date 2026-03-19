import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import type { ReadingOpinionQuestion } from "@/data/readingQuestions";

interface Props {
  question: ReadingOpinionQuestion;
  answers: (number | null)[];  // answer per statement: index of selected person
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
  const stmt = question.statements[currentStatement];
  if (!stmt) return null;

  const selected = answers[currentStatement];

  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Reading – Part 3</p>
          <p className="text-sm text-foreground">
            Statement {currentStatement + 1} of {question.statements.length}
          </p>
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

      <p className="text-xs text-muted-foreground mb-4">{question.instruction}</p>

      {/* People's opinions - scrollable cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {question.people.map((person, pi) => (
          <div key={pi} className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-heading font-bold text-foreground mb-2">{person.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{person.text}</p>
          </div>
        ))}
      </div>

      {/* Current statement */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStatement}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div className="bg-background rounded-xl p-6 mb-6">
            <h2 className="text-sm font-heading font-bold text-foreground mb-4">
              "{stmt.text}"
            </h2>
            <p className="text-xs text-muted-foreground mb-3">Who says this?</p>
            <div className="space-y-3">
              {question.people.map((person, pi) => {
                let cls = "border-border hover:border-primary/30 text-foreground hover:bg-muted/50";
                if (submitted) {
                  if (pi === stmt.correctPerson) cls = "border-success bg-success/10 text-success";
                  else if (pi === selected) cls = "border-destructive bg-destructive/10 text-destructive";
                  else cls = "border-border text-muted-foreground";
                } else if (selected === pi) {
                  cls = "border-primary bg-primary/5 text-primary";
                }
                return (
                  <button
                    key={pi}
                    onClick={() => !submitted && onAnswer(currentStatement, pi)}
                    disabled={submitted}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${cls}`}
                  >
                    {person.name}
                    {submitted && pi === stmt.correctPerson && <CheckCircle2 className="w-4 h-4 inline ml-2" />}
                    {submitted && pi === selected && pi !== stmt.correctPerson && <XCircle className="w-4 h-4 inline ml-2" />}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`mt-4 p-4 rounded-lg ${
                  selected === stmt.correctPerson ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
                }`}
              >
                <p className={`text-sm font-semibold ${selected === stmt.correctPerson ? "text-success" : "text-destructive"}`}>
                  {selected === stmt.correctPerson ? "✓ Chính xác!" : `✗ Đáp án đúng: ${question.people[stmt.correctPerson].name}`}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

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
