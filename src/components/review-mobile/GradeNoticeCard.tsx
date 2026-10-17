import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, RotateCcw, Hourglass, WifiOff, MicOff, AlertCircle } from "lucide-react";
import { useIsPro } from "@/hooks/useIsPro";
import { describeGradingError } from "@/lib/gradingErrorText";
import BuyCreditsDialog from "@/components/pro/BuyCreditsDialog";
import { fetchCreditPacks, formatVnd } from "@/hooks/useAiWallet";

interface Props {
  /** Mã lỗi gốc từ grader (vd. "quota_exceeded"). null = chưa có kết quả chấm. */
  error: string | null;
  canRegrade: boolean;
  regrading: boolean;
  onRegrade?: () => void;
}

/**
 * Thẻ trạng thái "chưa chấm được" cho màn xem lại trên ĐIỆN THOẠI.
 * Thay dòng chữ kỹ thuật "Không chấm được câu này: quota_exceeded" bằng câu tiếng Việt
 * + nút hành động đúng ngữ cảnh (Mua thêm lượt / Nâng cấp Pro / Chấm lại).
 */
const GradeNoticeCard = ({ error, canRegrade, regrading, onRegrade }: Props) => {
  const { isPro, isPremium } = useIsPro();
  const [buyOpen, setBuyOpen] = useState(false);
  const [cheapest, setCheapest] = useState<{ credits: number; price: number } | null>(null);
  const isQuotaErr = !!error && describeGradingError(error).kind === "quota";

  useEffect(() => {
    if (!isQuotaErr || !isPro || isPremium) return;
    let alive = true;
    fetchCreditPacks()
      .then((packs) => {
        const p = [...packs].sort((a, b) => a.price_vnd - b.price_vnd)[0];
        if (alive && p) setCheapest({ credits: p.credits, price: p.price_vnd });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isQuotaErr, isPro, isPremium]);

  if (!error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Chưa có kết quả chấm cho câu này.
        {canRegrade && onRegrade && (
          <button
            type="button"
            onClick={onRegrade}
            disabled={regrading}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-exam-accent text-sm font-bold text-exam-accent-foreground disabled:opacity-60"
          >
            {regrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {regrading ? "Đang chấm…" : "Chấm câu này"}
          </button>
        )}
      </div>
    );
  }

  const info = describeGradingError(error);
  const isQuota = info.kind === "quota";
  const proLike = isPro && !isPremium;
  const Icon = isQuota ? Hourglass : info.kind === "network" ? WifiOff : info.kind === "audio" ? MicOff : AlertCircle;

  const title = isQuota ? (proLike ? "Hết lượt chấm AI hôm nay" : "Hết lượt chấm AI miễn phí") : info.title;
  const body = isQuota
    ? proLike
      ? "Gói Pro có giới hạn lượt chấm AI mỗi ngày, dùng chung Writing + Speaking. Bài nói đã được lưu đầy đủ, lượt mới mở lúc 0:00."
      : "Bài nói đã được lưu đầy đủ. Nâng cấp Pro để AI chấm bài này và các bài sau."
    : info.body;

  const regradeBtn = canRegrade && onRegrade ? (
    <button
      type="button"
      onClick={onRegrade}
      disabled={regrading}
      className={
        isQuota
          ? "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 disabled:opacity-60"
          : "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-exam-accent text-sm font-bold text-exam-accent-foreground disabled:opacity-60"
      }
    >
      {regrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {regrading ? "Đang chấm…" : "Chấm lại"}
    </button>
  ) : null;

  return (
    <div
      className={
        isQuota
          ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
          : "rounded-2xl border border-border bg-card p-4"
      }
    >
      <p className={`flex items-center gap-2 text-[15px] font-bold ${isQuota ? "text-amber-900 dark:text-amber-200" : "text-foreground"}`}>
        <Icon className="h-4 w-4 shrink-0" /> {title}
      </p>
      <p className={`mt-1 text-[13px] leading-relaxed ${isQuota ? "text-amber-900/80 dark:text-amber-200/80" : "text-muted-foreground"}`}>
        {body}
      </p>

      {isQuota ? (
        <>
          <div className="mt-3 flex gap-2">
            {proLike ? (
              <button
                type="button"
                onClick={() => setBuyOpen(true)}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Mua thêm lượt
              </button>
            ) : (
              <Link
                to="/pricing"
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
              >
                Nâng cấp Pro
              </Link>
            )}
            {regradeBtn}
          </div>
          {proLike && (
            <p className="mt-2 text-[11.5px] text-amber-900/70 dark:text-amber-200/70">
              {cheapest ? `Gói từ ${formatVnd(cheapest.price)}/${cheapest.credits} lượt. ` : ""}Mua xong bấm "Chấm lại" là chấm ngay, không cần chờ đến mai.
            </p>
          )}
          {proLike && <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} />}
        </>
      ) : (
        regradeBtn && <div className="mt-3">{regradeBtn}</div>
      )}
    </div>
  );
};

export default GradeNoticeCard;
