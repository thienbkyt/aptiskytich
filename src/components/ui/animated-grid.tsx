import { cn } from "@/lib/utils";

interface AnimatedGridProps {
  className?: string;
  /** Show radial red/orange glow orbs over the grid */
  withOrbs?: boolean;
}

/**
 * Decorative tech grid background with drifting animation + optional glow orbs.
 * Place inside a `relative` parent (absolute fills parent).
 */
const AnimatedGrid = ({ className, withOrbs = true }: AnimatedGridProps) => {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 tech-grid-bg animate-grid-drift" />
      {withOrbs && (
        <>
          <div className="glow-orb glow-orb-red -top-24 -left-24 w-[420px] h-[420px]" />
          <div className="glow-orb glow-orb-orange top-1/3 -right-32 w-[360px] h-[360px]" />
          <div className="glow-orb glow-orb-violet bottom-0 left-1/3 w-[320px] h-[320px]" />
        </>
      )}
    </div>
  );
};

export default AnimatedGrid;
