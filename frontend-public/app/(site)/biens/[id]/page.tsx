import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { VirtualTourButton } from "@/components/site/virtual-tour-button"
import { formatPrice, formatPropertyType } from "@/lib/format"
import { getAvailablePropertyById } from "@/lib/properties"
import { MediaType } from "@/prisma/generated/client/enums"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const property = await getAvailablePropertyById(id)

  if (!property) {
    notFound()
  }

  const images = property.media.filter((media) => media.type === MediaType.IMAGE)
  const virtualTour = property.media.find(
    (media) => media.type === MediaType.VIRTUAL_TOUR
  )
  const mainImage = images[0]?.url

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/" />}
        className="mb-6 -ml-2"
      >
        ← Retour aux annonces
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
            {mainImage ? (
              <Image
                src={mainImage}
                alt={property.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
            ) : null}
            {virtualTour ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 sm:p-5">
                <p className="text-sm font-medium text-white">
                  Visite virtuelle 360° disponible
                </p>
              </div>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.slice(1, 5).map((media) => (
                <div
                  key={media.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <Image
                    src={media.url}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:pt-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              {formatPropertyType(property.type)}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {property.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{property.location}</p>
          </div>

          <p className="text-3xl font-semibold">
            {formatPrice(property.price)}
            <span className="text-base font-normal text-muted-foreground"> / mois</span>
          </p>

          <p className="leading-relaxed text-foreground/90">{property.description}</p>

          {property.features.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3">
              {property.features.map((feature) => (
                <div key={feature.id} className="rounded-lg bg-muted/60 px-3 py-2">
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
            {virtualTour ? (
              <VirtualTourButton
                propertyId={property.id}
                panoramaUrl={virtualTour.url}
                propertyTitle={property.title}
              />
            ) : null}
            <Button
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<Link href="/connexion" />}
            >
              Demander une visite
            </Button>
          </div>
        </aside>
      </div>
    </main>
  )
}
