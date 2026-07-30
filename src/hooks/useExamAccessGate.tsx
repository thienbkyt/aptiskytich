import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Gem, Crown } from "lucide-react";
import { useIsPro, tierRank, type UserTier } from "@/hooks/useIsPro";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMobileNotice } from "@/components/common/MobileNoticeGate";
import { supabase } from "@/integrations/supabase/client";

export type GateFeature = "full_part" | "full_test" | "marathon";

export interface GateOpts {
  feature: GateFeature;
  itemKey: string;
  setIds?: string[];
  noCharge?: boolean;
}

const FEATURE_LABEL: Record<GateFeature, string> = {
  full_part: "Luyện Full Part (miễn phí 3 đề)",
  full_test: "Thi thử Full Test (miễn phí 1 đề)",
  marathon: "Marathon (miễn phí 2 lượt)",
};


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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { openMobileNotice } = useMobileNotice();
  const [open, setOpen] = useState(false);
  const [needTier, setNeedTier] = useState<"pro" | "premium">("pro");
  const [quota, setQuota] = useState<{ feature: GateFeature; cap: number } | null>(null);

  const isLocked = useCallback(
    (set: MinimalSet | null | undefined) => {
      if (!set) return false;
      if (loading) return false;
      const req = normalizeTier(set.access_tier);
      return tierRank(tier) < tierRank(req);
    },
    [tier, loading],
  );

  const guard = useCallback(
    <T extends MinimalSet>(set: T, action: () => void, opts?: GateOpts) => {
      if (authLoading) return;
      if (!user) {
        const back = `${location.pathname}${location.search}`;
        navigate(`/auth?redirect=${encodeURIComponent(back)}`);
        return;
      }
      if (loading) {
        openMobileNotice(() => action());
        return;
      }
      if (!opts) {
        if (isLocked(set)) {
          const req = normalizeTier(set.access_tier);
          setNeedTier(req === "premium" ? "premium" : "pro");
          setOpen(true);
          return;
        }
        openMobileNotice(() => action());
        return;
      }

      if (!isLocked(set)) {
        openMobileNotice(() => action());
        return;
      }

      if (opts.noCharge) {
        // Resume: the opened_set rows were already created when the run started.
        openMobileNotice(() => action());
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      void (async () => {
        try {
          const { data, error } = await supabase.rpc("try_open_item", {
            p_feature: opts.feature,
            p_item_key: opts.itemKey,
            p_skill: null,
            p_set_ids: opts.setIds ?? null,
          } as any);
          const res = (data ?? {}) as { allowed?: boolean; cap?: number };
          if (error || !res.allowed) {
            setQuota({ feature: opts.feature, cap: Number(res.cap ?? 0) });
            setNeedTier("pro");
            setOpen(true);
            return;
          }
          openMobileNotice(() => action());
        } finally {
          inFlightRef.current = false;
        }
      })();

    },
    [isLocked, loading, user, authLoading, navigate, location.pathname, location.search, openMobileNotice],
  );

  const LockModal = () => (
    <UpgradeLock
      asModal
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setQuota(null); }}
      reason={quota ? "quota_exceeded" : needTier}
      need={quota ? "pro" : needTier}
      freeQuota={quota ? quota.cap : undefined}
      remaining={quota ? 0 : undefined}
      featureLabel={quota ? FEATURE_LABEL[quota.feature] : "Đề này"}
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
      <Badge variant="secondary" className={`text-[10px] font-bold bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white border-0 shadow-sm inline-flex items-center gap-1 ${className ?? ""}`}>
        {locked ? <Lock className="w-3 h-3" /> : <Gem className="w-3 h-3" />} PREMIUM
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={`text-[10px] font-bold bg-amber-500 text-white border-0 shadow-sm inline-flex items-center gap-1 ${className ?? ""}`}>
      {locked ? <Lock className="w-3 h-3" /> : <Crown className="w-3 h-3" />} PRO
    </Badge>
  );
}
