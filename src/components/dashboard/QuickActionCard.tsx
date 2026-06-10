import { Link } from "react-router-dom";
import { LucideIcon, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "red" | "orange" | "teal" | "violet" | "info";
}

const TONE_MAP: Record<NonNullable<QuickActionCardProps["tone"]>, { icon: string; glow: string }> = {
  red: { icon: "bg-gradient-to-br from-primary to-[#7a0f00] text-primary-foreground", glow: "hover:shadow-glow-red hover:border-primary/60" },
  orange: { icon: "bg-gradient-to-br from-accent to-primary text-white", glow: "hover:shadow-glow-soft hover:border-accent/60" },
  teal: { icon: "bg-gradient-to-br from-teal-500 to-emerald-600 text-white", glow: "hover:shadow-[0_0_24px_rgba(20,184,166,0.35)] hover:border-teal-500/60" },
  violet: { icon: "bg-gradient-to-br from-[#a78bfa] to-[#6d28d9] text-white", glow: "hover:shadow-[0_0_24px_rgba(167,139,250,0.35)] hover:border-[#a78bfa]/60" },
  info: { icon: "bg-gradient-to-br from-info to-blue-700 text-white", glow: "hover:shadow-[0_0_24px_hsl(var(--info)/0.35)] hover:border-info/60" },
};

const QuickActionCard = ({ to, icon: Icon, title, description, tone = "red" }: QuickActionCardProps) => {
  const t = TONE_MAP[tone];
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-4",
        "transition-all duration-300 hover:-translate-y-1",
        t.glow,
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110", t.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div>
        <div className="font-heading font-bold text-foreground leading-snug">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</div>
      </div>
    </Link>
  );
};

export default QuickActionCard;
