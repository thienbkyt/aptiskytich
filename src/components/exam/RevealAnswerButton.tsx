import { Eye, EyeOff } from "lucide-react";

interface Props {
  revealed: boolean;
  onToggle: () => void;
}

const NAVY = "hsl(var(--exam-accent))";

/**
 * Practice-only helper. Toggles reveal of correct answers + explanation
 * for the question/section currently on screen. Display-only — does NOT
 * submit the test or affect scoring.
 */
export default function RevealAnswerButton({ revealed, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="exam-fab-reveal fixed z-[90] flex items-center gap-1.5 rounded-full bg-exam-accent-soft/15 px-3 py-1.5 text-xs font-semibold shadow-lg border-2 transition-colors hover:bg-exam-accent-soft/25"
      style={{
        bottom: 120,
        left: 16,
        color: NAVY,
        borderColor: NAVY,
      }}
      aria-label={revealed ? "Ẩn đáp án" : "Hiện đáp án"}
    >
      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {revealed ? "Ẩn đáp án" : "Hiện đáp án"}
    </button>
  );
}
