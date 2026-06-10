import * as React from "react";
import { cn } from "@/lib/utils";

interface MagneticProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Magnetic strength (0-1). */
  strength?: number;
}

/**
 * Wraps a child (typically a Button) and shifts it slightly toward the cursor on hover.
 * Smooth, lightweight (no framer-motion).
 */
const MagneticButton = React.forwardRef<HTMLDivElement, MagneticProps>(
  ({ className, strength = 0.25, children, ...props }, ref) => {
    const innerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const el = innerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) * strength;
      const y = (e.clientY - (rect.top + rect.height / 2)) * strength;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onLeave = () => {
      const el = innerRef.current;
      if (el) el.style.transform = "translate3d(0, 0, 0)";
    };

    return (
      <div
        ref={innerRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={cn("inline-block transition-transform duration-200 ease-out will-change-transform", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MagneticButton.displayName = "MagneticButton";

export default MagneticButton;
