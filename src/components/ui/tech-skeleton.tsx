import { cn } from "@/lib/utils";

interface TechSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "card" | "row" | "text" | "circle" | "stat" | "hero" | "button";
  lines?: number;
  shimmer?: boolean;
  glow?: boolean;
}

const variantClasses: Record<string, string> = {
  card: "h-32 rounded-xl",
  row: "h-20 rounded-xl",
  text: "h-4 rounded-md",
  circle: "h-10 w-10 rounded-full",
  stat: "h-28 rounded-2xl",
  hero: "h-48 rounded-3xl",
  button: "h-10 rounded-lg w-32",
};

function TechSkeleton({
  className,
  variant = "text",
  lines = 1,
  shimmer = true,
  glow = false,
  ...props
}: TechSkeletonProps) {
  const baseClasses = cn(
    "relative overflow-hidden bg-muted/60",
    variantClasses[variant] || variantClasses.text,
    shimmer && "tech-shimmer",
    glow && "shadow-glow-soft",
    className
  );

  if (variant === "text" && lines > 1) {
    return (
      <div className="space-y-2.5" {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              i === lines - 1 && lines > 1 && "w-3/4"
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClasses} {...props} />;
}

/* ───── TechSkeletonGrid: pre-built layout blocks ───── */

function TechSkeletonGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}

function TechSkeletonCard() {
  return (
    <div className="space-y-3">
      <TechSkeleton variant="text" className="w-10 h-10 rounded-xl" />
      <TechSkeleton variant="text" className="w-3/4" />
      <TechSkeleton variant="text" className="w-full" />
      <TechSkeleton variant="text" className="w-1/2" />
    </div>
  );
}

function TechSkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-muted/30 overflow-hidden">
      <TechSkeleton variant="circle" className="h-12 w-12" />
      <div className="flex-1 space-y-2.5">
        <TechSkeleton variant="text" className="w-1/3 max-w-[180px]" />
        <TechSkeleton variant="text" className="w-2/3 max-w-[300px]" />
      </div>
      <TechSkeleton variant="button" className="hidden sm:block" />
    </div>
  );
}

function TechSkeletonStat() {
  return (
    <div className="space-y-3 p-5 rounded-2xl border border-border/40 bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-3">
        <TechSkeleton variant="circle" className="h-9 w-9" />
        <TechSkeleton variant="text" className="w-20" />
      </div>
      <TechSkeleton variant="text" className="w-16 h-7" />
      <TechSkeleton variant="text" className="w-12" />
    </div>
  );
}

/* ───── Pre-built loading pages ───── */

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-24 pb-20">
        <div className="section-container space-y-6">
          {/* Hero */}
          <TechSkeleton variant="hero" className="w-full" />

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <TechSkeleton key={i} variant="stat" />
            ))}
          </div>

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <TechSkeleton variant="card" className="h-48" />
              <TechSkeleton variant="card" className="h-64" />
            </div>
            <TechSkeleton variant="card" className="h-96" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="section-container space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <TechSkeleton variant="circle" className="h-10 w-10" />
          <TechSkeleton variant="text" className="w-48 h-8" />
        </div>
        <TechSkeleton variant="text" className="w-80 mb-6" />
        <TechSkeleton variant="row" className="h-12 w-full mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <TechSkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VocabStudySkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 pt-16">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border bg-card p-4">
          <div className="section-container flex items-center gap-4">
            <TechSkeleton variant="circle" className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <TechSkeleton variant="text" className="w-32" />
              <TechSkeleton variant="text" className="w-48" />
            </div>
            <TechSkeleton variant="text" className="w-16" />
          </div>
        </div>
        {/* Card */}
        <div className="section-container py-8 max-w-2xl mx-auto space-y-6">
          <TechSkeleton variant="card" className="h-64" />
          <div className="flex items-center justify-between">
            <TechSkeleton variant="button" />
            <TechSkeleton variant="button" />
            <TechSkeleton variant="button" />
          </div>
        </div>
      </main>
    </div>
  );
}

function SkillVocabSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 pt-16">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border py-10 md:py-14">
          <div className="section-container flex flex-col md:flex-row items-center gap-6">
            <TechSkeleton variant="circle" className="h-16 w-16" />
            <div className="text-center md:text-left space-y-2 flex-1">
              <TechSkeleton variant="text" className="w-56 h-8" />
              <TechSkeleton variant="text" className="w-80" />
            </div>
          </div>
        </div>
        <div className="section-container py-8 space-y-6">
          <TechSkeleton variant="row" className="h-12 w-full max-w-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <TechSkeleton key={i} variant="card" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export {
  TechSkeleton,
  TechSkeletonGrid,
  TechSkeletonCard,
  TechSkeletonRow,
  TechSkeletonStat,
  DashboardSkeleton,
  HistorySkeleton,
  VocabStudySkeleton,
  SkillVocabSkeleton,
};
