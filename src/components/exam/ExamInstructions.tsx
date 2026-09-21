import { useEffect } from "react";
import { applyUpdateIfPending } from "@/lib/registerPWA";
import type { QuestionItem } from "@/components/reading/BottomNavBar";

interface QuestionSection {
  title: string;
  questionCount?: number;
  isCurrent?: boolean;
  onClick?: () => void;
  questions?: QuestionItem[];
}

interface ExamInstructionsProps {
  skillName: string;
  timeLeft?: number;
  totalTime?: number;
  totalParts: number;
  totalMinutes: number;
  onStart: () => void;
  sections?: QuestionSection[];
  testTitle?: string;
  description?: string;
}

const ExamInstructions = ({
  skillName,
  totalParts,
  totalMinutes,
  onStart,
  testTitle,
  description,
}: ExamInstructionsProps) => {
  useEffect(() => {
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, []);

  // Safe moment to ship a pending app update: the student is still reading the
  // instructions, so no answers exist yet. Prevents stale bundles from running
  // for a whole session out of the PWA cache.
  useEffect(() => {
    applyUpdateIfPending();
  }, []);

  return (
    <div className="min-h-screen bg-exam-surface pl-[60px] pt-[40px] font-sans text-exam-text">
      <p className="text-sm text-exam-text-muted mb-2">Aptis General Practice Test</p>
      <h1 className="text-xl font-bold text-exam-text">
        {skillName} Practice Test
      </h1>
      {description ? (
        <p className="text-sm text-exam-text-muted mt-1 mb-6">{description}</p>
      ) : (
        <div className="mb-6" />
      )}
      <div className="flex gap-16 mb-6">
        <div>
          <p className="text-xs text-exam-text-muted mb-1">Number of Questions</p>
          <p className="text-sm font-bold text-exam-text">{totalParts}</p>
        </div>
        <div>
          <p className="text-xs text-exam-text-muted mb-1">Time Allowed</p>
          <p className="text-sm font-bold text-exam-text">{totalMinutes} min</p>
        </div>
      </div>
      <button
        onClick={onStart}
        className="bg-exam-accent text-white text-sm rounded-md px-6 py-2.5 hover:bg-exam-accent/90 transition-colors"
      >
        Start Assessment
      </button>
    </div>
  );
};

export default ExamInstructions;
