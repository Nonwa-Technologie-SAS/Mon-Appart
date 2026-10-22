import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"

type PricePeriod = "month" | "day" | "total" | "none"

const PERIOD_LABELS: Record<Exclude<PricePeriod, "none">, string> = {
  month: "/ mois",
  day: "/ jour",
  total: "prix total",
}

/**
 * Affichage unifié des prix XOF (F CFA).
 * Ne mélange jamais location mensuelle et vente sans période explicite.
 */
export function PriceDisplay({
  amount,
  period = "month",
  size = "md",
  className,
}: {
  amount: number
  period?: PricePeriod
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const sizeClass =
    size === "sm"
      ? "text-base sm:text-lg"
      : size === "lg"
        ? "text-2xl sm:text-3xl"
        : size === "xl"
          ? "text-2xl sm:text-3xl lg:text-[2rem]"
          : "text-lg sm:text-xl"

  const periodSize =
    size === "sm" || size === "md" ? "text-xs sm:text-sm" : "text-sm sm:text-base"

  return (
    <p className={cn("text-price", sizeClass, className)}>
      <span>{formatPrice(amount)}</span>
      {period !== "none" ? (
        <span
          className={cn(
            "ml-1 font-normal text-muted-foreground",
            periodSize
          )}
        >
          {PERIOD_LABELS[period]}
        </span>
      ) : null}
    </p>
  )
}
