import { AnimatePresence, motion } from "framer-motion";
import { useLocation, Routes } from "react-router-dom";
import { type ReactNode, type ReactElement, Children, cloneElement, isValidElement, useRef, useEffect, useState } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps <Routes> with a light fade-in entrance animation.
 *
 * We intentionally avoid AnimatePresence mode="wait" + exit animations because
 * switching browser tabs pauses requestAnimationFrame, which can leave the
 * outgoing route stuck in exit phase and the new route never mounts — resulting
 * in a blank page until a hard refresh.
 *
 * During an active exam we skip animation entirely so navigation between
 * instructions/parts stays instant and robust.
 */
const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const examActive = typeof window !== "undefined" && !!(window as any).__ktExamActive;

  // Inject `location` prop into <Routes> so it stays stable per pathname.
  const child = Children.only(children) as ReactElement;
  const routes = isValidElement(child)
    ? cloneElement(child, { location } as Record<string, unknown>)
    : child;

  if (reduced || examActive) return <>{routes}</>;

  return <AnimatedRoutes routes={routes} pathname={location.pathname} />;
};

const AnimatedRoutes = ({
  routes,
  pathname,
}: {
  routes: ReactElement;
  pathname: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Safety net: if Framer Motion gets stuck (e.g. tab throttling), force the
    // content visible after a short grace period.
    const timer = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const style = getComputedStyle(el);
      if (style.opacity === "0" || style.opacity === "0.0") {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      setVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        ref={ref}
        key={pathname}
        // NOTE: no `filter` here on purpose. A lingering `filter: blur(0px)` turns this
        // wrapper into a containing block for `position: fixed` children, which anchors
        // the exam bottom nav ("Next") to the page content instead of the viewport —
        // on phones the button ends up far below the fold.
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => setVisible(true)}
        style={visible ? { opacity: 1, transform: "none" } : undefined}
      >
        {routes}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
export { Routes };
