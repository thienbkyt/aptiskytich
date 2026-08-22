import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
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
  /** Overrides the auto-generated heading. */
  title?: string;
  /** Overrides the auto-generated description. */
  description?: string;
  /** Small helper line under the description (e.g. quota reset info). */
  resetNote?: string;
  remaining?: number | null;
  /** How many credits already consumed (rendered under the description). */
  used?: number | null;
  freeQuota?: number | null;


  asModal?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  className?: string;
}

function tierLabel(t?: UpgradeRequiredTier) {
  return "Pro";
}

function getCopy(
  reason: UpgradeReason | undefined,
  need: UpgradeRequiredTier,
  label?: string,
  remaining?: number | null,
  freeQuota?: number | null,
) {
  const name = label || "Tính năng này";

  if (reason === "disabled") {
    return {
      title: "Tính năng tạm khóa",
      desc: `${name} đang được tạm dừng. Vui lòng quay lại sau.`,
      cta: `Xem các gói`,
      showCTA: false,
    };
  }
  if (reason === "quota" || reason === "quota_exceeded") {
    return {
      title: "Bạn đã hết lượt dùng",
      desc: `${name} cho phép ${freeQuota ?? 0} lượt. Nâng cấp gói luyện thi để mở không giới hạn.`,
      cta: "Nâng cấp Pro",
      showCTA: true,
    };
  }
  return {
    title: "Tính năng dành cho Pro",
    desc: `${name} dành cho thành viên Pro. Nâng cấp để mở khóa.`,
    cta: "Nâng cấp Pro",
    showCTA: true,
    remainingHint:
      typeof remaining === "number" && remaining > 0
        ? `Bạn còn ${remaining} lượt dùng thử.`
        : undefined,
  };
}

function LockBody(props: UpgradeLockProps) {
  const { reason, featureLabel, remaining, freeQuota, resetNote, used, title, description } = props;

  const base = getCopy(reason, "pro", featureLabel, remaining, freeQuota);
  const copy = { ...base, title: title ?? base.title, desc: description ?? base.desc };
  const Icon = reason === "pro" || reason === "premium" ? Crown : Lock;
  const usedCap =
    typeof freeQuota === "number"
      ? freeQuota
      : typeof used === "number" && typeof remaining === "number"
        ? used + remaining
        : null;
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className={cn(
        "w-14 h-14 rounded-full flex items-center justify-center ring-2 bg-primary/10 ring-primary/30 text-primary",
      )}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-lg font-heading font-bold text-foreground">{copy.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{copy.desc}</p>
        {typeof used === "number" && (
          <p className="text-xs text-foreground/80 mt-1.5 font-medium">
            Bạn đã dùng {used}
            {usedCap !== null ? `/${usedCap}` : ""} lượt.
          </p>
        )}
        {resetNote && (
          <p className="text-xs text-muted-foreground mt-2 max-w-sm">{resetNote}</p>
        )}


        {(copy as any).remainingHint && (
          <p className="text-xs text-primary mt-2 font-medium">{(copy as any).remainingHint}</p>
        )}
      </div>
      {copy.showCTA && (
        <Button asChild variant="default" size="lg" className="gap-2">
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
