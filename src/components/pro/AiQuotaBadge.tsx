import { useState } from "react";
import { Sparkles, Plus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeature } from "@/hooks/useFeature";
import { useIsPro } from "@/hooks/useIsPro";
import { formatDateVi, useAiWallet } from "@/hooks/useAiWallet";
import BuyCreditsDialog from "./BuyCreditsDialog";

/** Badge shown next to the submit button so students know before finishing.
 *  Uses the shared AI grading quota (Writing + Speaking).
 *  Pro: hiện thêm số dư ví lượt + nút mua thêm khi lượt ngày còn ≤ 3. */
const AiQuotaBadge = ({
  className,
}: {
  className?: string;
}) => {
  const { isPro, isPremium } = useIsPro();
  const f = useFeature("ai_grading_writing");
  const proLike = isPro && !isPremium;
  const { wallet } = useAiWallet(proLike);
  const [buyOpen, setBuyOpen] = useState(false);

  if (isPremium || f.loading) return null;

  const remaining = typeof f.remaining === "number" ? Math.max(0, f.remaining) : 0;
  const used = typeof f.used === "number" ? f.used : null;
  const balance = wallet?.balance ?? (typeof f.creditsBalance === "number" ? f.creditsBalance : 0);
  const out = remaining <= 0 && (!proLike || balance <= 0);

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        out
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : remaining <= 1
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-muted/50 text-muted-foreground",
        !proLike && className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      {proLike
        ? `Hôm nay còn ${remaining} lượt`
        : out ? "Hết lượt chấm AI" : `Còn ${remaining} lượt chấm AI`}
    </span>
  );

  if (!proLike) return pill;

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <span className={cn("inline-flex rounded-full", className)}>{pill}</span>
      {balance > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
          title={wallet?.nextExpiry ? `Đợt gần nhất hết hạn ${formatDateVi(wallet.nextExpiry)}` : undefined}
        >
          <Wallet className="h-3 w-3" /> Ví {balance} lượt
        </span>
      )}
      {remaining <= 3 && (
        <button
          type="button"
          onClick={() => setBuyOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-3 w-3" /> Mua thêm lượt
        </button>
      )}
      <BuyCreditsDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        usageText={used !== null ? `Hôm nay ${used}/${used + remaining} lượt` : null}
        walletBalance={balance}
      />
    </span>
  );
};

export default AiQuotaBadge;
