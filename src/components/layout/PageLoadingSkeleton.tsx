import { TechSkeleton } from "@/components/ui/tech-skeleton";

/**
 * Suspense fallback shown while a lazy route chunk is loading.
 * Uses the "công nghệ" shimmer treatment so it matches the brand and
 * stays visually consistent with in-page skeletons (no flicker swap).
 */
const PageLoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Navbar placeholder */}
    <div className="h-16 border-b border-border bg-card/40 backdrop-blur-sm flex items-center px-4 sm:px-8 overflow-hidden">
      <TechSkeleton variant="text" className="h-7 w-32" />
      <div className="ml-auto flex items-center gap-3">
        <TechSkeleton variant="text" className="h-7 w-20 hidden sm:block" />
        <TechSkeleton variant="button" className="h-9 w-24" />
      </div>
    </div>

    {/* Content placeholder */}
    <div className="max-w-6xl mx-auto px-4 pt-10 pb-20 space-y-6">
      <TechSkeleton variant="text" className="h-10 w-2/3 max-w-md" />
      <TechSkeleton variant="text" className="h-5 w-1/2 max-w-sm" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <TechSkeleton key={i} variant="stat" />
        ))}
      </div>
      <TechSkeleton variant="hero" className="h-64 w-full" />
    </div>
  </div>
);

export default PageLoadingSkeleton;
