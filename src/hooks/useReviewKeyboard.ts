import { useEffect } from "react";

interface Options {
  onPrev?: () => void;
  onNext?: () => void;
  onExit?: () => void;
  enabled?: boolean;
}

/** Keyboard shortcuts for review pager: ← previous part, → next part, Esc exit. */
const useReviewKeyboard = ({ onPrev, onNext, onExit, enabled = true }: Options) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore when user is typing
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "Escape" && onExit) {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onExit, enabled]);
};

export default useReviewKeyboard;
