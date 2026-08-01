import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type VoucherInfo = {
  ok: boolean;
  reason?: string | null;
  kind?: string | null;
  gift_days?: number | null;
  gift_ai_credits?: number | null;
  applies_to_plans?: string[] | null;
  message?: string | null;
  code: string;
};

type Props = {
  mode: "redeem" | "preview";
  onApplied?: (info: VoucherInfo) => void;
  className?: string;
  compact?: boolean;
};

export default function VoucherInput({ mode, onApplied, className, compact }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VoucherInfo | null>(null);

  const submit = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const fn = mode === "redeem" ? "redeem_voucher" : "check_voucher";
      const { data, error } = await (supabase as any).rpc(fn, { p_code: normalized });
      if (error) throw error;
      const info: VoucherInfo = { ...(data as any), code: normalized };
      setResult(info);
      if (info.ok) onApplied?.(info);
    } catch {
      setResult({ ok: false, reason: "error", message: "Có lỗi khi kiểm tra mã. Bạn thử lại nhé.", code: normalized });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="NHẬP MÃ"
          spellCheck={false}
          autoCapitalize="characters"
          className={cn("h-9 uppercase tracking-wide font-semibold", compact && "max-w-[200px]")}
          style={{ textTransform: "uppercase" }}
        />
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 bg-[#CC1C01] hover:bg-[#4D0D0D] text-primary-foreground"
          disabled={busy || !code.trim()}
          onClick={submit}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          Áp dụng
        </Button>
      </div>

      {result?.message && (
        <p
          className={cn(
            "text-[12px] font-medium leading-snug",
            result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-[#B45309] dark:text-[#FEAD5F]",
          )}
        >
          {result.message}
          {result.reason === "checkout_only" && (
            <>
              {" "}
              <Link to="/pricing" className="underline underline-offset-2 font-semibold">Đến bảng giá</Link>
            </>
          )}
          {result.reason === "standalone" && (
            <>
              {" "}
              <Link to="/dashboard" className="underline underline-offset-2 font-semibold">Đến Dashboard</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
