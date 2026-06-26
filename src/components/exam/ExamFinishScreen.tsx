import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ExamFinishScreenProps {
  onSubmit: () => void;
  onCancel?: () => void;
  message?: string;
  title?: string;
  buttonText?: string;
  cancelText?: string;
}

const ExamFinishScreen = ({
  onSubmit,
  onCancel,
  message = "Once you submit your test you will no longer have access to the questions.",
  title = "Submit Test?",
  buttonText = "Submit test",
  cancelText = "Cancel",
}: ExamFinishScreenProps) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            className="px-6 py-2.5 rounded-lg bg-[#24085a] hover:bg-[#1a0640] text-white text-sm font-semibold transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ExamFinishScreen;
