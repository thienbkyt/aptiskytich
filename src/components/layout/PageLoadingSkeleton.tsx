import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback shown while a lazy route chunk is loading.
 * Mirrors the navbar height so the layout doesn't jump when the page renders.
 */
const PageLoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="h-16 border-b border-border bg-background flex items-center px-4 sm:px-8">
      <Skeleton className="h-7 w-32" />
      <div className="ml-auto flex items-center gap-3">
        <Skeleton className="h-7 w-20 hidden sm:block" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
    <div className="max-w-6xl mx-auto px-4 pt-10 pb-20 space-y-6">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-1/2 max-w-sm" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  </div>
);

export default PageLoadingSkeleton;
