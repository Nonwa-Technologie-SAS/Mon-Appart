"use client"

import { PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { withdrawOwnedListing } from "@/app/actions/properties"
import { PropertyStatusToggle } from "@/components/espace/property-status-toggle"
import { Button } from "@/components/ui/button"
import { PropertyStatus } from "@/lib/domain-enums"
import { cn } from "@/lib/utils"

export function OwnedPropertyActions({
  listingId,
  status,
  layout = "toolbar",
}: {
  listingId: string
  status: PropertyStatus
  /** `toolbar` : barre compacte (défaut). `stack` : colonnes pour grille. */
  layout?: "toolbar" | "stack"
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleWithdraw() {
    if (!confirming) {
      setConfirming(true)
      setError(null)
      return
    }
    startTransition(async () => {
      const result = await withdrawOwnedListing({ listingId })
      if (result.error) {
        setError(result.error)
        setConfirming(false)
        return
      }
      router.refresh()
    })
  }

  if (confirming) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/20 bg-destructive/5 p-3",
          layout === "stack" ? "w-full" : "min-w-[14rem] max-w-xs",
        )}
        role="group"
        aria-label="Confirmation du retrait"
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          Retirer du catalogue ? L&apos;annonce reste archivée sur le serveur.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5"
            disabled={isPending}
            onClick={handleWithdraw}
          >
            <Trash2Icon aria-hidden className="size-3.5" />
            {isPending ? "Retrait…" : "Confirmer"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={isPending}
            onClick={() => setConfirming(false)}
          >
            <XIcon aria-hidden className="size-3.5" />
            Annuler
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        layout === "stack"
          ? "w-full flex-col"
          : "flex-col items-stretch sm:items-end",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          layout === "stack" && "w-full",
        )}
        role="group"
        aria-label="Actions sur l'annonce"
      >
        <PropertyStatusToggle
          propertyId={listingId}
          status={status}
          compact
        />
        <Button
          variant="outline"
          size="sm"
          className="min-h-9 gap-1.5"
          nativeButton={false}
          render={<Link href={`/espace/biens/${listingId}/modifier`} />}
        >
          <PencilIcon aria-hidden className="size-3.5" />
          Modifier
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleWithdraw}
        >
          <Trash2Icon aria-hidden className="size-3.5" />
          Retirer
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
