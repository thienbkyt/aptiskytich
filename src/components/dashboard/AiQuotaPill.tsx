import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeature } from "@/hooks/useFeature";
import { useIsPro } from "@/hooks/useIsPro";

function capOf(f: ReturnType<typeof useFeature>) {
  if (f.tier === "free") return f.freeQuota ?? 3;
  return f.proQuota ?? f.freeQuota ?? 10;
}

function lineText(f: ReturnType<typeof useFeature>) {
  if (f.loading) return "—";
  const cap = capOf(f);
  const remaining =
    typeof f.remaining === "number" ? Math.max(0, f.remaining) : Math.max(0, cap - (f.used ?? 0));
  if (f.tier === "free") return `còn ${remaining}/${cap} lượt dùng thử`;
  return `còn ${remaining}/${cap} lượt hôm nay`;
}

function isOut(f: ReturnType<typeof useFeature>) {
  if (f.loading) return false;
  const cap = capOf(f);
  const remaining =
    typeof f.remaining === "number" ? f.remaining : cap - (f.used ?? 0);
  return remaining <= 0;
}

/** Small dashboard card showing remaining AI grading credits (Writing + Speaking). */
const AiQuotaPill = ({ className }: { className?: string }) => {
  const { isPremium } = useIsPro();
  const writing = useFeature("ai_grading_writing");
  const speaking = useFeature("ai_grading_speaking");

  const out = !isPremium && (isOut(writing) || isOut(speaking));

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
          <div className="mt-0.5 space-y-0.5">
            <div className="text-[11px] leading-tight text-foreground">
              <span className="font-semibold">Writing</span>{" "}
              <span className="text-muted-foreground">{lineText(writing)}</span>
            </div>
            <div className="text-[11px] leading-tight text-foreground">
              <span className="font-semibold">Speaking</span>{" "}
              <span className="text-muted-foreground">{lineText(speaking)}</span>
            </div>
            {out && (
              <Link
                to="/pricing"
                className="mt-1 inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Nâng cấp
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiQuotaPill;
