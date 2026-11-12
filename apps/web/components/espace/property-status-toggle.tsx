"use client"

import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { updatePropertyListingStatus } from "@/app/actions/properties"
import { PropertyStatus } from "@/lib/domain-enums"
import { cn } from "@/lib/utils"

export function PropertyStatusToggle({
  propertyId,
  status,
  compact = false,
}: {
  propertyId: string
  status: PropertyStatus
  /** Bouton court pour barres d'actions (tableau / liste). */
  compact?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const available = status === PropertyStatus.AVAILABLE
  const nextStatus = available
    ? PropertyStatus.ARCHIVED
    : PropertyStatus.AVAILABLE

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await updatePropertyListingStatus({
        propertyId,
        status: nextStatus,
      })
      if (result.error) {
        setError(result.error)
      }
    })
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={isPending}
          aria-pressed={available}
          title={
            available
              ? "Masquer l'annonce des recherches"
              : "Remettre l'annonce en ligne"
          }
          onClick={handleClick}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
            available
              ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {available ? (
            <EyeIcon aria-hidden className="size-3.5" />
          ) : (
            <EyeOffIcon aria-hidden className="size-3.5" />
          )}
          {isPending ? "…" : available ? "En ligne" : "Masquée"}
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className={cn(
          "inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-50",
          available
            ? "border-border bg-card text-foreground hover:bg-muted"
            : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {available ? (
          <EyeOffIcon aria-hidden className="size-4" />
        ) : (
          <EyeIcon aria-hidden className="size-4" />
        )}
        {isPending
          ? "Mise à jour…"
          : available
            ? "Masquer l'annonce"
            : "Remettre en ligne"}
      </button>
      <p className="text-xs text-muted-foreground">
        {available
          ? "Visible dans les recherches."
          : "Masquée pour les visiteurs."}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
