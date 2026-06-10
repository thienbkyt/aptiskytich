import * as React from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, adds hover lift + red glow */
  interactive?: boolean;
  /** Adds a soft red radial overlay for hero-style cards */
  spotlight?: boolean;
}

/**
 * Tech-dark card with subtle border + optional red glow on hover.
 * Use across landing/dashboard/practice grids.
 */
const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, interactive = true, spotlight = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm",
          "shadow-md transition-all duration-300",
          interactive && "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow-red",
          className,
        )}
        {...props}
      >
        {spotlight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
            style={{ background: "var(--gradient-radial-red)" }}
          />
        )}
        <div className="relative">{children}</div>
      </div>
    );
  },
);
GlowCard.displayName = "GlowCard";

export default GlowCard;
