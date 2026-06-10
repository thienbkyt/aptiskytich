import * as React from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Spotlight color in `r, g, b` form. Defaults to brand red. */
  color?: string;
  /** Spotlight radius (px). */
  radius?: number;
}

/**
 * Card with a mouse-tracked radial spotlight.
 * Wrap your content with it. Falls back to a static glow when reduced-motion is on.
 */
const SpotlightCard = React.forwardRef<HTMLDivElement, SpotlightCardProps>(
  ({ className, color = "204, 28, 1", radius = 320, children, ...props }, ref) => {
    const innerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const el = innerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };

    return (
      <div
        ref={innerRef}
        onMouseMove={onMove}
        className={cn(
          "group/spot relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm",
          "shadow-md transition-all duration-300 overflow-hidden",
          "hover:-translate-y-0.5 hover:border-primary/50",
          className,
        )}
        style={
          {
            "--spot-color": color,
            "--spot-radius": `${radius}px`,
          } as React.CSSProperties
        }
        {...props}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background:
              "radial-gradient(var(--spot-radius) circle at var(--mx, 50%) var(--my, 50%), rgba(var(--spot-color), 0.18), transparent 60%)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    );
  },
);
SpotlightCard.displayName = "SpotlightCard";

export default SpotlightCard;
