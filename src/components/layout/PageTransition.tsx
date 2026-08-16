import { AnimatePresence, motion } from "framer-motion";
import { useLocation, Routes } from "react-router-dom";
import { type ReactNode, type ReactElement, Children, cloneElement, isValidElement } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps <Routes> with AnimatePresence so each route fades + lifts on enter/exit.
 * Pass exactly one <Routes> child. We re-render its `location` prop to drive AnimatePresence.
 */
const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Inject `location` prop into <Routes> so it stays stable per pathname.
  const child = Children.only(children) as ReactElement;
  const routes = isValidElement(child)
    ? cloneElement(child, { location } as Record<string, unknown>)
    : child;

  if (reduced) return <>{routes}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        // NOTE: no `filter` here on purpose. A lingering `filter: blur(0px)` turns this
        // wrapper into a containing block for `position: fixed` children, which anchors
        // the exam bottom nav ("Next") to the page content instead of the viewport —
        // on phones the button ends up far below the fold.
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}

      >
        {routes}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
export { Routes };
