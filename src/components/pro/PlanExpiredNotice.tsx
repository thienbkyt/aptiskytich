import { Button } from "@/components/ui/button";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { formatExpiry } from "@/lib/examLoadError";

interface PlanExpiredNoticeProps {
  proUntil?: string | null;
  /** Optional "back to list" action rendered under the upgrade CTA. */
  onExit?: () => void;
  className?: string;
}

/**
 * Shown when a learner enters an exam room but the questions are hidden because
 * their Pro plan expired. Never let them take a blank test.
 */
export default function PlanExpiredNotice({ proUntil, onExit, className }: PlanExpiredNoticeProps) {
  const expiry = formatExpiry(proUntil);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 gap-4">
      <UpgradeLock
        reason="pro"
        className={className}
        title="Gói của bạn đã hết hạn"
        description={
          expiry
            ? `Gói Pro của bạn đã hết hạn ngày ${expiry}, nên đề này tạm thời không mở được. Gia hạn để tiếp tục luyện thi.`
            : "Gói Pro của bạn đã hết hạn, nên đề này tạm thời không mở được. Gia hạn để tiếp tục luyện thi."
        }
      />
      {onExit && (
        <Button variant="ghost" onClick={onExit}>
          Về danh sách đề
        </Button>
      )}
    </div>
  );
}
