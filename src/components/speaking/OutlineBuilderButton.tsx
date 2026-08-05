import { NotebookPen, X } from "lucide-react";

interface Props {
  open: boolean;
  onToggle: () => void;
}

const NAVY = "#002F5F";

/**
 * Practice-only helper. Toggles the "Nháp" scratchpad panel.
 * Sits above RevealAnswerButton so the two floating buttons never overlap.
 */
export default function OutlineBuilderButton({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed z-[90] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md border transition-colors hover:bg-slate-50"
      style={{ bottom: 160, left: 16, color: NAVY, borderColor: NAVY }}
      aria-label={open ? "Đóng nháp" : "Nháp"}
    >
      {open ? <X className="w-3.5 h-3.5" /> : <NotebookPen className="w-3.5 h-3.5" />}
      {open ? "Đóng nháp" : "Nháp"}
    </button>
  );
}

