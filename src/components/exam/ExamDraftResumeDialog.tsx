import { createPortal } from "react-dom";
import { RotateCcw, PlayCircle } from "lucide-react";
import { formatDraftTime, type ExamDraft } from "@/lib/examDraft";

interface Props {
  draft: ExamDraft;
  partLabel?: string;
  onResume: () => void;
  onDiscard: () => void;
}

/** Hỏi học viên có muốn làm tiếp bài đang dở (sau khi tải lại trang / bị out). */
const ExamDraftResumeDialog = ({ draft, partLabel, onResume, onDiscard }: Props) => {
  if (typeof document === "undefined") return null;
  const saved = new Date(draft.savedAt);
  const savedLabel = saved.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-heading font-bold text-foreground">Bạn có bài đang làm dở</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">{draft.title}</span>
          {partLabel ? <> · {partLabel}</> : null}
          <br />
          Đã lưu lúc {savedLabel}
          {draft.timeLeft != null ? <> · còn {formatDraftTime(draft.timeLeft)} phút</> : null}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <PlayCircle className="h-4 w-4" /> Làm tiếp bài này
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Bỏ, chọn bài khác
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ExamDraftResumeDialog;
