import { cn } from "@/lib/utils"

export function PropertyCardSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex animate-pulse overflow-hidden rounded-xl border border-border bg-card",
          className
        )}
        aria-hidden="true"
      >
        <div className="aspect-square w-24 shrink-0 bg-muted sm:w-36" />
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="mt-auto h-4 w-28 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex animate-pulse flex-col overflow-hidden rounded-xl border border-border bg-card",
        className
      )}
      aria-hidden="true"
    >
      <div className="aspect-16/10 bg-muted" />
      <div className="flex flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4">
        <div className="h-4 w-4/5 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="mt-2 h-6 w-32 rounded bg-muted" />
      </div>
    </div>
  )
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Chargement des annonces"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <PropertyCardSkeleton />
        </li>
      ))}
    </ul>
  )
}
