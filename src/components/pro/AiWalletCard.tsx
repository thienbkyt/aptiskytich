import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateVi, useAiWallet } from "@/hooks/useAiWallet";
import BuyCreditsDialog from "./BuyCreditsDialog";

/** Ví lượt chấm AI trong trang tài khoản (chỉ render cho Pro). */
const AiWalletCard = () => {
  const { wallet } = useAiWallet(true);
  const [open, setOpen] = useState(false);
  const balance = wallet?.balance ?? 0;
  const rows = (wallet?.grants ?? []).slice(0, 5);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Ví lượt chấm AI: {balance} lượt</p>
            <p className="text-[11px] text-muted-foreground">
              {balance > 0 && wallet?.nextExpiry
                ? `Đợt gần nhất hết hạn ${formatDateVi(wallet.nextExpiry)} · dùng khi hết lượt ngày`
                : "Dùng khi đã hết lượt trong ngày của gói"}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Mua lượt
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-amber-200/70 pt-2 dark:border-amber-800/60">
          {rows.map((g) => {
            const left = Math.max(0, g.amount - g.used);
            const expired = !!g.expires_at && new Date(g.expires_at).getTime() < Date.now();
            return (
              <div key={g.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="truncate text-foreground">{formatDateVi(g.granted_at)} · {g.label}</span>
                <span className={expired ? "shrink-0 text-muted-foreground line-through" : "shrink-0 text-muted-foreground"}>
                  còn {left}/{g.amount}{g.expires_at ? ` · HSD ${formatDateVi(g.expires_at)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <BuyCreditsDialog open={open} onOpenChange={setOpen} walletBalance={balance} />
    </div>
  );
};

export default AiWalletCard;
