import { useState, useCallback } from "react";
import { Lock } from "lucide-react";
import { useIsPro } from "@/hooks/useIsPro";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { Badge } from "@/components/ui/badge";

interface MinimalSet {
  access_tier?: string | null;
}

/**
 * Gate exam-set opening based on access_tier.
 * Pro/promo users can open all sets; free users only 'free' sets.
 * Usage:
 *   const { guard, isLocked, LockModal } = useExamAccessGate();
 *   onClick={() => guard(set, () => doOpen(set))}
 *   render <LockModal /> once at root.
 */
export function useExamAccessGate() {
  const { isPro, loading } = useIsPro();
  const [open, setOpen] = useState(false);

  const isLocked = useCallback(
    (set: MinimalSet | null | undefined) =>
      !!set && set.access_tier === "pro" && !isPro,
    [isPro],
  );

  const guard = useCallback(
    <T extends MinimalSet>(set: T, action: () => void) => {
      if (isLocked(set)) {
        setOpen(true);
        return;
      }
      action();
    },
    [isLocked],
  );

  const LockModal = () => (
    <UpgradeLock
      asModal
      open={open}
      onOpenChange={setOpen}
      reason="pro"
      featureLabel="Đề này"
    />
  );

  return { isPro, isProLoading: loading, guard, isLocked, LockModal };
}

/** Small Pro/Free badge for an exam-set card. */
export function ExamTierBadge({
  tier,
  locked,
  className,
}: {
  tier?: string | null;
  locked?: boolean;
  className?: string;
}) {
  if (tier === "free") {
    return (
      <Badge variant="secondary" className={`text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 ${className ?? ""}`}>
        FREE
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={`text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 inline-flex items-center gap-1 ${className ?? ""}`}>
      {locked && <Lock className="w-3 h-3" />} PRO
    </Badge>
  );
}
