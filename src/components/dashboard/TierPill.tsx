import { useNavigate } from "react-router-dom";
import { Crown, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateSafe } from "@/lib/safeDate";

interface TierPillProps {
  tier: "free" | "pro" | "premium";
  isPro: boolean;
  isPremium: boolean;
  proUntil: string | null;
  className?: string;
}

const formatDate = (iso: string | null) => {
  const d = parseDateSafe(iso);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const TierPill = ({ tier, isPro, isPremium, proUntil, className }: TierPillProps) => {
  const navigate = useNavigate();
  const goPricing = () => navigate("/pricing");

  const Icon = isPremium ? Gem : Crown;

  // Visual variants
  const wrapClass = isPremium
    ? "border-[#FEAD5F]/60 bg-gradient-to-br from-[#FEAD5F]/20 via-[#CC1C01]/10 to-transparent hover:border-[#FEAD5F] hover:shadow-[0_0_24px_-6px_rgba(254,173,95,0.6)]"
    : isPro
      ? "border-[#FEAD5F]/50 bg-gradient-to-br from-[#FEAD5F]/15 via-[#CC1C01]/5 to-transparent hover:border-[#FEAD5F] hover:shadow-[0_0_20px_-8px_rgba(254,173,95,0.5)]"
      : "border-border bg-card/70 hover:border-primary/50 hover:shadow-glow-soft";

  const iconClass = isPro || isPremium
    ? "bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] text-white ring-[#FEAD5F]/40"
    : "from-muted/40 to-muted/10 text-muted-foreground bg-gradient-to-br ring-border";

  const label = isPremium ? "Premium" : isPro ? "Pro" : "Miễn phí";

  const sub = isPremium
    ? (proUntil ? `Đến ${formatDate(proUntil)}` : "Trọn đời")
    : isPro
      ? (proUntil ? `Đến ${formatDate(proUntil)}` : "Đang kích hoạt")
      : "Mở khóa toàn bộ";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goPricing}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goPricing(); } }}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border px-4 py-5 cursor-pointer backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5",
        wrapClass,
        className,
      )}
    >
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
        iconClass,
      )}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground truncate">Gói hiện tại</div>
        <div className={cn(
          "text-xl font-heading font-extrabold leading-tight truncate",
          isPro || isPremium
            ? "bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]"
            : "text-foreground",
        )}>
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
        {!isPremium && (
          <button
            onClick={(e) => { e.stopPropagation(); goPricing(); }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm hover:brightness-110"
          >
            <Crown className="w-3 h-3" />
            {isPro ? "Lên Premium" : "Nâng cấp"}
          </button>
        )}
      </div>
    </div>
  );
};

export default TierPill;
