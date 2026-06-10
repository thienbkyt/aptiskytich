import { cn } from "@/lib/utils";

interface GradientOrbProps {
  className?: string;
  /** Tailwind color preset for the orb. */
  tone?: "red" | "orange" | "violet" | "blue";
  /** Pixel size. */
  size?: number;
}

const toneMap = {
  red: "hsl(var(--primary) / 0.35)",
  orange: "hsl(var(--accent) / 0.32)",
  violet: "hsl(280 80% 55% / 0.28)",
  blue: "hsl(210 80% 55% / 0.28)",
};

/**
 * Soft glowing orb that gently "breathes" (scale + opacity).
 * Place inside a relative+overflow-hidden parent.
 */
const GradientOrb = ({ className, tone = "red", size = 380 }: GradientOrbProps) => {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl animate-breathing",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: toneMap[tone],
      }}
    />
  );
};

export default GradientOrb;
