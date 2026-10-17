import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathItem, SkillStat, Tier } from "@/hooks/useLearningPath";
import { SKILL_VI, TIERS, TIER_VI } from "@/hooks/useLearningPath";

export const TIER_PILL: Record<Tier, string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  low: "bg-muted text-muted-foreground",
};
const TIER_BAR: Record<Tier, string> = {
  high: "bg-primary",
  medium: "bg-orange-500",
  low: "bg-muted-foreground/50",
};

export const Bubble = ({ parts }: { parts: Array<string | { b: string }> }) => (
  <p className="text-[13.5px] leading-snug text-foreground">
    {parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <b key={i} className="text-primary">{p.b}</b>))}
  </p>
);

export const TierBars = ({ stat, compact = false }: { stat: SkillStat; compact?: boolean }) => {
  const rows = TIERS.filter((t) => stat.tiers[t].total > 0);
  if (!rows.length) return <p className="text-xs text-muted-foreground">Key hôm nay chưa có đề {SKILL_VI[stat.skill]}.</p>;
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {rows.map((t) => {
        const s = stat.tiers[t];
        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
        return (
          <div key={t} className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5 text-[12.5px]">
            <span className={cn("rounded-full px-2 py-0.5 text-center text-[11px] font-extrabold", TIER_PILL[t])}>{TIER_VI[t]}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", TIER_BAR[t])} style={{ width: `${pct}%` }} />
            </div>
            <span className="min-w-[44px] text-right font-extrabold tabular-nums">
              {s.done}/{s.total}
              {s.locked > 0 && <Lock className="ml-1 inline h-3 w-3 -translate-y-px text-muted-foreground" />}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const NextItem = ({ item, primary = false }: { item: PathItem; primary?: boolean }) => (
  <Link
    to={item.route || "#"}
    className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/50"
  >
    <div className="min-w-0 flex-1">
      <div className="text-[11.5px] text-muted-foreground">
        {SKILL_VI[item.skill]} · {item.partLabel} ·{" "}
        <span className={cn("font-extrabold", item.priority === "high" ? "text-primary" : item.priority === "medium" ? "text-orange-600" : "text-muted-foreground")}>
          {TIER_VI[item.priority]}
        </span>
      </div>
      <div className="truncate text-[13.5px] font-bold text-foreground">{item.title}</div>
    </div>
    <span
      className={cn(
        "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-extrabold",
        primary ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground",
      )}
    >
      Làm
    </span>
  </Link>
);
