"use client"

import { ListingContactMessageDialog } from "@/components/site/listing-contact-message-dialog"
import { PriceDisplay } from "@/components/site/price-display"
import { RequestVisitDialog } from "@/components/site/request-visit-dialog"

/**
 * Barre de contact sticky sur mobile : prix + CTA visibles sans scroll.
 * Sur desktop, les CTA restent dans le flux de la fiche.
 */
export function ListingContactBar({
  propertyId,
  propertyTitle,
  price,
  isAuthenticated,
}: {
  propertyId: string
  propertyTitle: string
  price: number
  isAuthenticated: boolean
}) {
  return (
    <div
      id="visite"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 px-4 py-3 shadow-[var(--elevation-lg)] backdrop-blur-sm lg:static lg:z-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:block lg:pb-0">
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate text-xs text-muted-foreground">
            {propertyTitle}
          </p>
          <PriceDisplay amount={price} size="sm" />
        </div>
        <div className="flex w-[min(100%,16rem)] shrink-0 flex-col gap-2 sm:w-auto lg:w-full">
          <RequestVisitDialog
            propertyId={propertyId}
            propertyTitle={propertyTitle}
            isAuthenticated={isAuthenticated}
          />
          <ListingContactMessageDialog
            listingId={propertyId}
            listingTitle={propertyTitle}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>
    </div>
  )
}
