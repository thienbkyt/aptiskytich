import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatPillProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: "red" | "orange" | "violet" | "success";
  className?: string;
}

const ACCENT_MAP: Record<NonNullable<StatPillProps["accent"]>, string> = {
  red: "from-primary/30 to-primary/5 text-primary",
  orange: "from-accent/30 to-accent/5 text-accent",
  violet: "from-[#a78bfa]/30 to-[#a78bfa]/5 text-[#a78bfa]",
  success: "from-success/30 to-success/5 text-success",
};

const StatPill = ({ icon: Icon, label, value, accent = "red", className }: StatPillProps) => {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border border-border bg-card/70 backdrop-blur-sm px-4 py-3",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow-soft",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-inset ring-border",
          ACCENT_MAP[accent],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-heading font-extrabold text-foreground leading-tight truncate">{value}</div>
      </div>
    </div>
  );
};

export default StatPill;
