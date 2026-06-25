import { Link } from "react-router-dom";
import { Crown, Lock, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type UpgradeReason = "pro" | "premium" | "quota" | "quota_exceeded" | "disabled" | string;
export type UpgradeRequiredTier = "pro" | "premium";

export interface UpgradeLockProps {
  /** "pro" / "premium" = tier-gated. "quota" = ran out. "disabled" = feature off. */
  reason?: UpgradeReason;
  /** Required tier to unlock (also used to tailor CTA when reason is "quota"). */
  requiredTier?: UpgradeRequiredTier;
  /** What tier the user needs to upgrade to (overrides requiredTier when present). */
  need?: UpgradeRequiredTier;
  featureLabel?: string;
  remaining?: number | null;
  freeQuota?: number | null;
  asModal?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  className?: string;
}

function tierLabel(t?: UpgradeRequiredTier) {
  return t === "premium" ? "Premium" : "Pro";
}

function getCopy(
  reason: UpgradeReason | undefined,
  need: UpgradeRequiredTier,
  label?: string,
  remaining?: number | null,
  freeQuota?: number | null,
) {
  const name = label || "Tính năng này";
  const tName = tierLabel(need);

  if (reason === "disabled") {
    return {
      title: "Tính năng tạm khóa",
      desc: `${name} đang được tạm dừng. Vui lòng quay lại sau.`,
      cta: `Xem các gói`,
      showCTA: false,
    };
  }
  if (reason === "quota" || reason === "quota_exceeded") {
    const target = need === "premium"
      ? "Nâng cấp Premium để dùng KHÔNG GIỚI HẠN."
      : "Nâng cấp Pro để có thêm lượt mỗi tháng (hoặc Premium để không giới hạn).";
    return {
      title: "Bạn đã hết lượt dùng",
      desc: `${name} cho phép ${freeQuota ?? 0} lượt miễn phí. ${target}`,
      cta: `Nâng cấp ${tName}`,
      showCTA: true,
    };
  }
  if (need === "premium") {
    return {
      title: "Tính năng dành cho Premium",
      desc: `${name} chỉ mở cho thành viên Premium (trọn đời). Nâng cấp để mở khóa toàn bộ.`,
      cta: "Nâng cấp Premium",
      showCTA: true,
    };
  }
  return {
    title: "Tính năng dành cho Pro",
    desc: `${name} dành cho thành viên Pro hoặc Premium. Nâng cấp để mở khóa.`,
    cta: "Nâng cấp Pro",
    showCTA: true,
    remainingHint:
      typeof remaining === "number" && remaining > 0
        ? `Bạn còn ${remaining} lượt dùng thử.`
        : undefined,
  };
}

function LockBody(props: UpgradeLockProps) {
  const { reason, featureLabel, remaining, freeQuota } = props;
  const need: UpgradeRequiredTier =
    props.need ?? props.requiredTier ?? (reason === "premium" ? "premium" : "pro");
  const copy = getCopy(reason, need, featureLabel, remaining, freeQuota);
  const Icon = need === "premium" ? Gem : reason === "pro" || reason === "premium" ? Crown : Lock;
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center ring-2",
        need === "premium"
          ? "bg-[#FEAD5F]/15 ring-[#FEAD5F]/40 text-[#CC1C01]"
          : "bg-primary/10 ring-primary/30 text-primary",
      )}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-lg font-heading font-bold text-foreground">{copy.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{copy.desc}</p>
        {(copy as any).remainingHint && (
          <p className="text-xs text-primary mt-2 font-medium">{(copy as any).remainingHint}</p>
        )}
      </div>
      {copy.showCTA && (
        <Button asChild variant="default" size="lg" className={cn(
          "gap-2",
          need === "premium" && "bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110",
        )}>
          <Link to="/pricing">
            <Icon className="w-4 h-4" /> {copy.cta}
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
            <DialogTitle className="sr-only">Nâng cấp</DialogTitle>
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
