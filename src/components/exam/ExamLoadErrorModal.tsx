import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { useIsPro, tierRank } from "@/hooks/useIsPro";

export type ExamLoadFailReason = "empty_result" | "fetch_failed";

export interface ExamLoadErrorState {
  /** Which of the two branches logged in client_error_logs. */
  reason: ExamLoadFailReason;
  /** access_tier of the exam_set the learner tried to open. */
  accessTier?: string | null;
}

/**
 * Shown instead of the exam engine when questions could not be loaded.
 *
 * - reason "empty_result" + a set the learner's tier cannot read → RLS blocked the
 *   rows on purpose: show the Pro upgrade lock, never an empty exam room.
 * - reason "fetch_failed" (network / timeout) → retry screen that re-runs the same
 *   loader, so the learner never has to reload the page.
 */
export default function ExamLoadErrorModal({
  state,
  onClose,
  onRetry,
}: {
  state: ExamLoadErrorState | null;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const { tier } = useIsPro();
  if (!state) return null;

  const req = state.accessTier === "premium" ? "premium" : state.accessTier === "pro" ? "pro" : "free";
  const tierBlocked = req !== "free" && tierRank(tier) < tierRank(req);

  if (state.reason === "empty_result" && tierBlocked) {
    return (
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Nâng cấp</DialogTitle>
            <DialogDescription className="sr-only">Đề này dành cho thành viên Pro</DialogDescription>
          </DialogHeader>
          <UpgradeLock reason="pro" featureLabel="Đề này" className="border-0 shadow-none p-0" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Không tải được đề
          </DialogTitle>
          <DialogDescription>
            {state.reason === "fetch_failed"
              ? "Kết nối mạng bị ngắt khi tải câu hỏi. Bấm “Thử lại” để tải lại đề — bài đang làm không bị mất."
              : "Đề này hiện không có câu hỏi hiển thị được. Vui lòng thử lại hoặc chọn đề khác."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2 flex-1">
              <RotateCcw className="w-4 h-4" /> Thử lại
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">
            Chọn đề khác
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
