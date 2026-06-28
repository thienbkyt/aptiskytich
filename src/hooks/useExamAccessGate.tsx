import { useState, useCallback } from "react";
import { Lock, Gem, Crown } from "lucide-react";
import { useIsPro, tierRank, type UserTier } from "@/hooks/useIsPro";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { Badge } from "@/components/ui/badge";

interface MinimalSet {
  access_tier?: string | null;
}

function normalizeTier(t?: string | null): UserTier {
  if (t === "premium") return "premium";
  if (t === "pro") return "pro";
  return "free";
}

/**
 * Gate exam-set opening based on access_tier (3 tiers: free/pro/premium).
 * Opens if user's tier rank >= required set tier rank.
 */
export function useExamAccessGate() {
  const { isPro, tier, loading } = useIsPro();
  const [open, setOpen] = useState(false);
  const [needTier, setNeedTier] = useState<"pro" | "premium">("pro");

  const isLocked = useCallback(
    (set: MinimalSet | null | undefined) => {
      if (!set) return false;
      // Fail-open while tier is still loading — don't show a lock for a paying
      // user just because the RPC hasn't resolved yet. Server (grade-exam) is
      // the source of truth.
      if (loading) return false;
      const req = normalizeTier(set.access_tier);
      return tierRank(tier) < tierRank(req);
    },
    [tier, loading],
  );

  const guard = useCallback(
    <T extends MinimalSet>(set: T, action: () => void) => {
      // If tier is still loading, just let the action through; server enforces.
      if (loading) {
        action();
        return;
      }
      if (isLocked(set)) {
        const req = normalizeTier(set.access_tier);
        setNeedTier(req === "premium" ? "premium" : "pro");
        setOpen(true);
        return;
      }
      action();
    },
    [isLocked, loading],
  );

  const LockModal = () => (
    <UpgradeLock
      asModal
      open={open}
      onOpenChange={setOpen}
      reason={needTier}
      need={needTier}
      featureLabel="Đề này"
    />
  );

  return { isPro, isProLoading: loading, guard, isLocked, LockModal, tier };
}

/** Tier badge for an exam-set card. */
export function ExamTierBadge({
  tier,
  locked,
  className,
}: {
  tier?: string | null;
  locked?: boolean;
  className?: string;
}) {
  const t = normalizeTier(tier);
  if (t === "free") {
    return (
      <Badge variant="secondary" className={`text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 ${className ?? ""}`}>
        FREE
      </Badge>
    );
  }
  if (t === "premium") {
    return (
      <Badge variant="secondary" className={`text-[10px] font-semibold bg-gradient-to-r from-[#CC1C01]/15 to-[#FEAD5F]/30 text-[#CC1C01] dark:text-[#FEAD5F] border-0 inline-flex items-center gap-1 ${className ?? ""}`}>
        {locked ? <Lock className="w-3 h-3" /> : <Gem className="w-3 h-3" />} PREMIUM
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={`text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 inline-flex items-center gap-1 ${className ?? ""}`}>
      {locked ? <Lock className="w-3 h-3" /> : <Crown className="w-3 h-3" />} PRO
    </Badge>
  );
}
