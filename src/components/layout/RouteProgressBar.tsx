import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Top-of-viewport "tech" progress bar that animates briefly on every route change.
 * Provides a consistent loading cue to bridge route transitions and Suspense fallbacks,
 * preventing the flicker between unmount → fallback → mount.
 */
const RouteProgressBar = () => {
  const { pathname } = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    setVisible(true);
    setProgress(reduced ? 100 : 12);

    const t1 = window.setTimeout(() => setProgress(72), 80);
    const t2 = window.setTimeout(() => setProgress(94), 280);
    const t3 = window.setTimeout(() => setProgress(100), 520);
    const t4 = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 780);

    return () => {
      [t1, t2, t3, t4].forEach(clearTimeout);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity .25s ease" }}
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width .35s cubic-bezier(.22,1,.36,1)",
        }}
      />
    </div>
  );
};

export default RouteProgressBar;
