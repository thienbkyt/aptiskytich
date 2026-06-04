import { useState } from "react";
import { LogOut } from "lucide-react";
import ExamFinishScreen from "./ExamFinishScreen";

interface ExamHeaderProps {
  skillLabel: string;
  partLabel: string;
  onExit?: () => void;
  /** If true, skip the confirm popup and exit immediately on click. */
  immediateExit?: boolean;
}

const ExamHeader = ({ skillLabel, partLabel, onExit, immediateExit = false }: ExamHeaderProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    if (!onExit) return;
    if (immediateExit) {
      onExit();
      return;
    }
    // Open confirm dialog — keep timers/audio running in background
    setShowConfirm(true);
  };

  return (
    <>
      <div className="w-full bg-[#24085a] text-white px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/70">{skillLabel}</p>
          <p className="text-sm font-bold">{partLabel}</p>
        </div>
        {onExit && (
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Thoát
          </button>
        )}
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
