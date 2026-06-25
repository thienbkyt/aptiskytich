import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const getInitial = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.innerWidth < MOBILE_BREAKPOINT;
  } catch {
    return false;
  }
};

export function useIsMobile() {
  // Synchronous initial value — stable from the very first render so
  // dependent components never flip hook trees on the second render.
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitial);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`) ?? null;
    } catch {
      mql = null;
    }
    const onChange = () => {
      try {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      } catch {
        /* noop */
      }
    };
    if (mql?.addEventListener) mql.addEventListener("change", onChange);
    else mql?.addListener?.(onChange);
    onChange();
    return () => {
      if (mql?.removeEventListener) mql.removeEventListener("change", onChange);
      else mql?.removeListener?.(onChange);
    };
  }, []);

  return isMobile;
}
