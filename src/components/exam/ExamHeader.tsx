import { useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import ExamFinishScreen from "./ExamFinishScreen";


interface ExamHeaderProps {
  skillLabel: string;
  partLabel: string;
  onExit?: () => void;
  /** If true, skip the confirm popup and exit immediately on click. */
  immediateExit?: boolean;
  /** When provided, render a "← Quay lại kết quả" button (review mode). */
  onBackToResults?: () => void;
}

const ExamHeader = ({ skillLabel, partLabel, onExit, immediateExit = false, onBackToResults }: ExamHeaderProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  // Mark body so global floating UI (e.g. Zalo FAB) hides while in-exam.
  useEffect(() => {
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, []);



  const handleClick = () => {
    if (!onExit) return;
    // In review mode, exit immediately — the test is already submitted.
    if (immediateExit || onBackToResults) {
      onExit();
      return;
    }
    setShowConfirm(true);
  };

  return (
    <>
      <div className="w-full bg-[#24085a] text-white px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/70">{skillLabel}</p>
          <p className="text-sm font-bold">{partLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToResults && (
            <button
              type="button"
              onClick={onBackToResults}
              className="exam-header-back-btn flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại kết quả
            </button>
          )}
          {onExit && (
            <button
              type="button"
              onClick={handleClick}
              className="exam-header-exit-btn flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Thoát
            </button>
          )}
        </div>
      </div>
      {showConfirm && (
        <ExamFinishScreen
          title="Submit Test?"
          message="Once you submit your test you will no longer have access to the questions."
          buttonText="Submit test"
          cancelText="Cancel"
          onSubmit={() => {
            setShowConfirm(false);
            onExit?.();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};

export default ExamHeader;
