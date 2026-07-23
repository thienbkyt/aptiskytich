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
  /** When provided, exit button opens a Marathon submit dialog instead of the default confirm. */
  onMarathonFinish?: () => void;
}

const ExamHeader = ({ skillLabel, partLabel, onExit, immediateExit = false, onBackToResults, onMarathonFinish }: ExamHeaderProps) => {
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
      {showConfirm && onMarathonFinish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Thoát marathon?</h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">Tiến độ đã được lưu tự động. Lần sau bạn có thể vào làm tiếp từ đúng chỗ đang dừng.</p>
            <div className="flex flex-col gap-3 items-center">
              <button onClick={() => { setShowConfirm(false); onExit?.(); }} className="w-full px-6 py-3 rounded-lg bg-[#CC1C01] hover:bg-[#4D0D0D] text-white text-sm font-semibold transition-colors">Lưu & thoát</button>
              <button onClick={() => setShowConfirm(false)} className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">Ở lại</button>
            </div>
          </div>
        </div>
      )}
      {showConfirm && !onMarathonFinish && (
        <ExamFinishScreen
          title="Thoát bài thi?"
          message="Bài làm của bạn sẽ không được lưu."
          buttonText="Thoát"
          cancelText="Ở lại"
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
