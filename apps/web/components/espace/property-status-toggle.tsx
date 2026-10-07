"use client"

import { useState, useTransition } from "react"

import { updatePropertyListingStatus } from "@/app/actions/properties"
import { Button } from "@/components/ui/button"
import { PropertyStatus } from "@/prisma/generated/client/enums"

export function PropertyStatusToggle({
  propertyId,
  status,
}: {
  propertyId: string
  status: PropertyStatus
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

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant={available ? "outline" : "default"}
        disabled={isPending}
        className="w-full"
        onClick={handleClick}
      >
        {isPending
          ? "Mise à jour…"
          : available
            ? "Marquer comme non disponible"
            : "Marquer comme disponible"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {available
          ? "Le bien reste visible dans les recherches."
          : "Le bien est masqué pour les visiteurs."}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
