import { useEffect } from "react";

interface Options {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Arrow-key navigation for marathon modes.
 * ← previous, → next. Ignores typing targets, modifier keys and key repeat.
 */
export function useMarathonArrowKeys({ enabled, onPrev, onNext }: Options): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      e.preventDefault();
      if (e.key === "ArrowLeft") onPrev();
      else onNext();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onPrev, onNext]);
}

export default useMarathonArrowKeys;
