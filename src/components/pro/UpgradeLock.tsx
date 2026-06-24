import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface UpgradeLockProps {
  /** "pro" = cần Pro để dùng. "quota" = đã hết lượt free. "disabled" = tắt. */
  reason?: "pro" | "quota" | "disabled" | string;
  featureLabel?: string;
  remaining?: number | null;
  freeQuota?: number | null;
  /** Render as modal (controlled) or inline card (default). */
  asModal?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  className?: string;
}

function getCopy(reason?: string, label?: string, remaining?: number | null, freeQuota?: number | null) {
  const name = label || "Tính năng này";
  if (reason === "disabled") {
    return {
      title: "Tính năng tạm khóa",
      desc: `${name} đang được tạm dừng. Vui lòng quay lại sau.`,
      showCTA: false,
    };
  }
  if (reason === "quota" || reason === "quota_exceeded") {
    return {
      title: "Bạn đã hết lượt dùng thử",
      desc: `${name} cho phép ${freeQuota ?? 0} lượt miễn phí. Nâng cấp Pro để dùng không giới hạn.`,
      showCTA: true,
    };
  }
  return {
    title: "Tính năng dành cho Pro",
    desc: `${name} chỉ dành cho thành viên Pro. Nâng cấp để mở khóa toàn bộ tính năng.`,
    showCTA: true,
    remainingHint:
      typeof remaining === "number" && remaining > 0
        ? `Bạn còn ${remaining} lượt dùng thử.`
        : undefined,
  };
}

function LockBody({ reason, featureLabel, remaining, freeQuota }: UpgradeLockProps) {
  const copy = getCopy(reason, featureLabel, remaining, freeQuota);
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/30">
        {reason === "pro" ? <Crown className="w-7 h-7 text-primary" /> : <Lock className="w-7 h-7 text-primary" />}
      </div>
      <div>
        <h3 className="text-lg font-heading font-bold text-foreground">{copy.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{copy.desc}</p>
        {(copy as any).remainingHint && (
          <p className="text-xs text-primary mt-2 font-medium">{(copy as any).remainingHint}</p>
        )}
      </div>
      {copy.showCTA && (
        <Button asChild variant="default" size="lg" className="gap-2">
          <Link to="/pricing">
            <Crown className="w-4 h-4" /> Nâng cấp Pro
          </Link>
        </Button>
      )}
    </div>
  );
}

export default function UpgradeLock(props: UpgradeLockProps) {
  const { asModal, open, onOpenChange, className } = props;

  if (asModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Nâng cấp Pro</DialogTitle>
            <DialogDescription className="sr-only">Mở khóa tính năng</DialogDescription>
          </DialogHeader>
          <LockBody {...props} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-card p-6 md:p-8 shadow-sm",
        className,
      )}
    >
      <LockBody {...props} />
    </div>
  );
}
