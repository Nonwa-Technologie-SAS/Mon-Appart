import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PropertyImageGallery } from "@/components/site/property-image-gallery"
import { RequestVisitDialog } from "@/components/site/request-visit-dialog"
import { VirtualTourButton } from "@/components/site/virtual-tour-button"
import { formatPrice, formatPropertyType } from "@/lib/format"
import { getSession } from "@/lib/auth-session"
import { getAvailablePropertyById } from "@/lib/properties"
import { MediaType, PropertyStatus } from "@/prisma/generated/client/enums"

export const dynamic = "force-dynamic"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, session] = await Promise.all([params, getSession()])
  const property = await getAvailablePropertyById(id, session?.user.id)

  if (!property) {
    notFound()
  }

  const images = property.media
    .filter((media) => media.type === MediaType.IMAGE)
    .map((media) => ({
      id: media.id,
      url: media.url,
      room: media.room,
      sortOrder: media.sortOrder,
    }))
  const virtualTour = property.media.find(
    (media) => media.type === MediaType.VIRTUAL_TOUR
  )
  const available = property.status === PropertyStatus.AVAILABLE

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-10 lg:py-14 lg:pb-14">
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/" />}
        className="mb-4 -ml-2 sm:mb-6"
      >
        ← Retour aux annonces
      </Button>

      {available ? null : (
        <p className="mb-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Cette annonce n’est plus visible par les visiteurs.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
        <PropertyImageGallery
          images={images}
          title={property.title}
          hasVirtualTour={images.length > 0 || Boolean(virtualTour)}
        />

        <aside className="flex flex-col gap-6 lg:pt-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              {formatPropertyType(property.type)}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {property.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{property.location}</p>
          </div>

          <p className="text-2xl font-bold text-primary sm:text-3xl">
            {formatPrice(property.price)}
            <span className="text-base font-normal text-muted-foreground"> / mois</span>
          </p>

          <p className="leading-relaxed text-foreground/90">{property.description}</p>

          {property.features.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3">
              {property.features.map((feature) => (
                <div key={feature.id} className="rounded-md border border-border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{feature.name}</dt>
                  <dd className="font-medium">{feature.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {property.agency ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Proposé par</p>
              <p className="font-medium">{property.agency.name}</p>
              {property.agency.phone ? (
                <p className="mt-1 text-sm">{property.agency.phone}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {images.length > 0 || virtualTour ? (
              <VirtualTourButton
                propertyId={property.id}
                propertyTitle={property.title}
                photos={images}
                panoramaUrl={virtualTour?.url}
              />
            ) : null}
            {available ? (
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-sm lg:static lg:z-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="mx-auto max-w-6xl pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:pb-0">
                  <RequestVisitDialog
                    propertyId={property.id}
                    propertyTitle={property.title}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
