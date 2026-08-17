import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeature } from "@/hooks/useFeature";
import { useIsPro } from "@/hooks/useIsPro";

/** Badge shown next to the submit button so students know before finishing.
 *  Uses the shared AI grading quota (Writing + Speaking). */
const AiQuotaBadge = ({
  className,
}: {
  className?: string;
}) => {
  const { isPremium } = useIsPro();
  const f = useFeature("ai_grading_writing");

  if (isPremium || f.loading) return null;

  const cap = f.tier === "free" ? f.freeQuota ?? 3 : f.proQuota ?? f.freeQuota ?? 10;
  const remaining =
    typeof f.remaining === "number" ? f.remaining : cap - (f.used ?? 0);
  const out = remaining <= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        out
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : remaining <= 1
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      {out ? "Hết lượt chấm AI" : `Còn ${remaining} lượt chấm AI`}
    </span>
  );
};

export default AiQuotaBadge;

