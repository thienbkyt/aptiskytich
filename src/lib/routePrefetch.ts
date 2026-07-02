/**
 * Route prefetch registry.
 *
 * Maps URL paths to the same `() => import("...")` factories used by React.lazy
 * in App.tsx. Vite/Rollup deduplicates chunks by module identity, so calling
 * these factories early warms the same chunk that <Suspense> will later await —
 * making navigation feel near-instant.
 *
 * Also prefetches the page's primary data via React Query when a `prefetchData`
 * function is provided.
 */
import type { QueryClient } from "@tanstack/react-query";

type Loader = () => Promise<unknown>;
type DataPrefetch = (qc: QueryClient) => Promise<unknown> | void;

interface RouteEntry {
  load: Loader;
  prefetchData?: DataPrefetch;
}

// Same factories as in App.tsx — referencing the same module specifier
// guarantees the chunk is shared, not duplicated.
const routes: Record<string, RouteEntry> = {
  "/dashboard":   { load: () => import("@/pages/Dashboard") },
  "/course":      { load: () => import("@/pages/Course") },
  "/auth":        { load: () => import("@/pages/Auth") },
  "/grammar":     { load: () => import("@/pages/GrammarVocabulary") },
  "/reading":     { load: () => import("@/pages/Reading") },
  "/listening":   { load: () => import("@/pages/Listening") },
  "/speaking":    { load: () => import("@/pages/Speaking") },
  "/writing":     { load: () => import("@/pages/Writing") },
  "/vocabulary":  { load: () => import("@/pages/SkillPractice") },
  "/thi-thu":     { load: () => import("@/pages/FullTest") },
  "/history":     { load: () => import("@/pages/History") },
  "/progress":    { load: () => import("@/pages/Progress") },
  "/admin":              { load: () => import("@/pages/Admin") },
  "/admin/report":       { load: () => import("@/pages/AdminReport") },
  "/admin/students":     { load: () => import("@/pages/AdminStudents") },
};

const prefetched = new Set<string>();

/** Match a pathname to a registry entry (exact match, then prefix match). */
function resolveEntry(path: string): RouteEntry | undefined {
  if (routes[path]) return routes[path];
  // Dynamic segments: try parent path (e.g. /vocabulary/123 -> /vocabulary)
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 0) {
    parts.pop();
    const candidate = "/" + parts.join("/");
    if (routes[candidate]) return routes[candidate];
  }
  return undefined;
}

/** Trigger code-split chunk + optional data prefetch for a given route. */
export function prefetchRoute(path: string, qc?: QueryClient): void {
  if (prefetched.has(path)) return;
  const entry = resolveEntry(path);
  if (!entry) return;
  prefetched.add(path);
  // Fire-and-forget. Errors are non-fatal — the real navigation will surface them.
  entry.load().catch(() => prefetched.delete(path));
  if (qc && entry.prefetchData) {
    try { entry.prefetchData(qc); } catch { /* ignore */ }
  }
}

/**
 * Hover/focus handlers to spread on <Link>s.
 * Uses pointerenter so it fires on both mouse + touch, and `onFocus` for keyboard.
 */
export function prefetchHandlers(path: string) {
  const trigger = () => prefetchRoute(path);
  return {
    onMouseEnter: trigger,
    onFocus: trigger,
    onTouchStart: trigger,
  };
}

/**
 * Idle prefetch is disabled — heavy routes (dashboard, admin) pull in large
 * chunks (recharts, exceljs) that we don't want in the initial load path.
 * Kept as a no-op so existing callers don't break.
 */
export function prefetchOnIdle(_paths: string[]): void {
  /* intentionally empty */
}
