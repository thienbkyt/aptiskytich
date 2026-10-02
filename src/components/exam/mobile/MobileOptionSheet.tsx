import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

export interface SheetOption {
  value: number;
  label: string;
  /** Ghi chú nhỏ bên phải, vd. "đang ở đoạn 2". Không làm mờ lựa chọn. */
  note?: string;
}

interface Props {
  open: boolean;
  title?: string;
  /** Câu/đoạn chứa chỗ trống, hiện phía trên danh sách để học viên khỏi phải nhớ. */
  context?: ReactNode;
  options: SheetOption[];
  selected: number | null | undefined;
  onSelect: (value: number) => void;
  onClose: () => void;
}

/** Bảng chọn trượt từ dưới lên — thay dropdown trên điện thoại. */
const MobileOptionSheet = ({ open, title, context, options, selected, onSelect, onClose }: Props) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="kt-sheet-root fixed inset-0 z-[130] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 kt-sheet-fade" onClick={onClose} />
      <div
        className="kt-sheet-panel relative bg-exam-surface text-exam-text rounded-t-2xl shadow-2xl max-h-[78vh] flex flex-col"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <span className="block w-10 h-1.5 rounded-full bg-exam-border" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pb-2">
          <div className="min-w-0">
            {title && <p className="text-sm font-bold">{title}</p>}
            {context && <div className="mt-1 text-[13px] leading-relaxed text-exam-text-muted">{context}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 w-9 h-9 -mr-1 flex items-center justify-center rounded-full hover:bg-exam-border/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-3 pb-2 space-y-2">
          {options.map((o) => {
            const on = selected === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onSelect(o.value)}
                className={`w-full min-h-[48px] flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] leading-snug transition-colors ${
                  on
                    ? "border-exam-accent bg-exam-accent-soft/15 font-semibold"
                    : "border-exam-border bg-exam-surface active:bg-exam-border/40"
                }`}
              >
                <span className="flex-1 min-w-0">{o.label}</span>
                {o.note && !on && (
                  <span className="shrink-0 text-[11px] font-medium text-exam-text-muted">{o.note}</span>
                )}
                {on && <Check className="w-5 h-5 shrink-0 text-exam-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MobileOptionSheet;
