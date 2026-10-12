import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchCreditPacks, formatVnd, type AiCreditPack } from "@/hooks/useAiWallet";

interface Props {
  /** Dòng tình trạng: vd "Gói 1 tháng · 20/20 lượt hôm nay". */
  usageText?: string | null;
  walletBalance?: number | null;
  onCancel?: () => void;
  cancelLabel?: string;
}

/** Chọn & mua gói lượt chấm AI (chỉ hiển thị cho tài khoản Pro). */
const BuyCreditsPanel = ({ usageText, walletBalance, onCancel, cancelLabel = "Để sau" }: Props) => {
  const [packs, setPacks] = useState<AiCreditPack[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCreditPacks().then((p) => {
      if (!alive) return;
      setPacks(p);
      const def = p.find((x) => x.badge === "Phổ biến") ?? p[Math.min(1, p.length - 1)] ?? null;
      setPicked(def?.key ?? null);
    });
    return () => { alive = false; };
  }, []);

  const pack = packs.find((p) => p.key === picked) ?? null;

  const buy = async () => {
    if (!pack) return;
    setBuying(true);
    try {
      const returnPath = `${window.location.pathname}${window.location.search}`
        .replace(/[?&]credits_(paid|cancel)=1/g, "");
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { plan_key: pack.key, return_path: returnPath || "/" },
      });
      if (error || !(data as any)?.checkoutUrl) {
        toast.error("Không tạo được link thanh toán", {
          description: "Vui lòng thử lại hoặc nhắn admin qua Zalo/Facebook.",
        });
        return;
      }
      window.location.href = (data as any).checkoutUrl as string;
    } catch {
      toast.error("Lỗi kết nối", { description: "Thử lại sau ít phút." });
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="w-full text-left">
      {(usageText || typeof walletBalance === "number") && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[13px] text-foreground">
          {usageText ? <span>{usageText}</span> : <span />}
          {typeof walletBalance === "number" && (
            <span>Ví lượt: <b className="text-primary">{walletBalance}</b></span>
          )}
        </div>
      )}

      {packs.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải gói lượt…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {packs.map((p) => {
            const on = p.key === picked;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPicked(p.key)}
                className={cn(
                  "relative flex items-center justify-between gap-2 rounded-2xl border-[1.5px] bg-card px-4 py-3 text-left transition sm:flex-col sm:justify-start sm:px-2 sm:py-3.5 sm:text-center",
                  on ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:border-primary/40",
                )}
              >
                {p.badge && (
                  <span className={cn(
                    "absolute -top-2.5 right-3 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
                    /tiết kiệm/i.test(p.badge) ? "bg-emerald-600" : "bg-primary",
                  )}>{p.badge}</span>
                )}
                <span className="sm:block">
                  <span className="block text-xl font-black leading-none text-foreground sm:text-[26px]">
                    {p.credits}<span className="ml-1 text-sm font-bold text-muted-foreground sm:ml-0 sm:block sm:text-xs">lượt</span>
                  </span>
                  <span className="mt-1 block text-[11.5px] text-muted-foreground">
                    {formatVnd(p.price_vnd / p.credits)}/lượt
                  </span>
                </span>
                <span className="text-base font-extrabold text-primary sm:mt-2 sm:text-[17px]">{formatVnd(p.price_vnd)}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        • Dùng chung cho Writing &amp; Speaking · hạn dùng {pack?.valid_days ?? 90} ngày từ lúc mua.<br />
        • Chỉ trừ vào ví khi đã hết lượt trong ngày của gói Pro.
      </p>

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="shrink-0">{cancelLabel}</Button>
        )}
        <Button type="button" onClick={buy} disabled={!pack || buying} className="flex-1 font-bold">
          {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {pack ? `Mua ${pack.credits} lượt · ${formatVnd(pack.price_vnd)}` : "Chọn gói"}
        </Button>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        Hay chấm nhiều mỗi ngày? <Link to="/pricing" className="font-semibold text-primary hover:underline">Xem gói Pro nhiều lượt/ngày →</Link>
      </p>
    </div>
  );
};

export default BuyCreditsPanel;
