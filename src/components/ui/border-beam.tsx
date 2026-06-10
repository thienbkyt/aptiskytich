import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  /** Beam length as % of perimeter. */
  size?: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** CSS color. */
  colorFrom?: string;
  colorTo?: string;
}

/**
 * Animated light beam that travels around the border of its parent.
 * Parent must be `relative` and ideally `rounded-*` + `overflow-hidden`.
 */
const BorderBeam = ({
  className,
  size = 180,
  duration = 8,
  colorFrom = "hsl(var(--primary))",
  colorTo = "hsl(var(--accent))",
}: BorderBeamProps) => {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        "after:absolute after:aspect-square after:w-[var(--size)] after:animate-border-beam after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_var(--size))]",
        className,
      )}
      style={
        {
          "--size": `${size}px`,
          "--duration": `${duration}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
    />
  );
};

export default BorderBeam;
