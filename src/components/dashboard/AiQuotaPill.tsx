import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeature } from "@/hooks/useFeature";
import { useIsPro } from "@/hooks/useIsPro";

function capOf(f: ReturnType<typeof useFeature>) {
  if (f.tier === "free") return f.freeQuota ?? 3;
  return f.proQuota ?? f.freeQuota ?? 10;
}

function formatQuota(f: ReturnType<typeof useFeature>) {
  if (f.loading) {
    return { main: "—", sub: "", out: false };
  }
  const cap = capOf(f);
  const remaining =
    typeof f.remaining === "number" ? Math.max(0, f.remaining) : Math.max(0, cap - (f.used ?? 0));
  const out = remaining <= 0;
  const sub =
    f.tier === "free"
      ? out
        ? "đã hết lượt dùng thử"
        : "lượt dùng thử còn lại"
      : out
        ? "đã hết lượt hôm nay"
        : "lượt còn lại hôm nay";
  return { main: `${remaining}/${cap}`, sub, out };
}

/** Small dashboard card showing remaining AI grading credits (shared pool for Writing + Speaking). */
const AiQuotaPill = ({ className }: { className?: string }) => {
  const { isPremium } = useIsPro();
  const f = useFeature("ai_grading_writing");
  const { main, sub, out } = formatQuota(f);
  const creditsBalance = f.creditsBalance ?? 0;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border px-4 py-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5",
        out
          ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
          : "border-border bg-card/70 hover:border-primary/50 hover:shadow-glow-soft",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ring-border",
          out ? "from-destructive/30 to-destructive/5 text-destructive" : "from-accent/30 to-accent/5 text-accent",
        )}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground truncate">Lượt chấm AI</div>
        {isPremium ? (
          <div className="text-base font-heading font-extrabold text-foreground leading-tight">
            Không giới hạn
          </div>
        ) : (
          <>
            <div className={cn(
              "text-2xl font-heading font-extrabold leading-tight",
              out ? "text-destructive" : "text-foreground",
            )}>
              {main}
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground truncate">{sub}</div>
            {creditsBalance > 0 && (
              <div className="text-[11px] leading-tight text-accent truncate">
                +{creditsBalance} lượt tặng từ mã ưu đãi
              </div>
            )}
            {out && (
              <Link
                to="/pricing"
                className="mt-1 inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Nâng cấp
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AiQuotaPill;

