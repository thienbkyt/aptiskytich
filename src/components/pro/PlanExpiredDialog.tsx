import UpgradeLock from "@/components/pro/UpgradeLock";
import { formatExpiry } from "@/lib/examLoadError";

interface PlanExpiredDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proUntil?: string | null;
}

/**
 * Modal shown when the learner tries to start an exam whose questions are hidden
 * because their Pro plan expired. Blocks entering the exam room entirely.
 */
export default function PlanExpiredDialog({ open, onOpenChange, proUntil }: PlanExpiredDialogProps) {
  const expiry = formatExpiry(proUntil);
  return (
    <UpgradeLock
      asModal
      open={open}
      onOpenChange={onOpenChange}
      reason="pro"
      title="Gói của bạn đã hết hạn"
      description={
        expiry
          ? `Gói Pro của bạn đã hết hạn ngày ${expiry}, nên đề này không mở được. Gia hạn để tiếp tục luyện thi.`
          : "Gói Pro của bạn đã hết hạn, nên đề này không mở được. Gia hạn để tiếp tục luyện thi."
      }
    />
  );
}
