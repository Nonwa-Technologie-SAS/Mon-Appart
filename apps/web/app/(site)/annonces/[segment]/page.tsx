import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { JsonLd } from "@/components/seo/json-ld"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListingContactBar } from "@/components/site/listing-contact-bar"
import { ListingGrowthActions } from "@/components/site/listing-growth-actions"
import { ListingReportForm } from "@/components/site/listing-report-form"
import { ListingSafetyNotice } from "@/components/site/listing-safety-notice"
import { PriceDisplay } from "@/components/site/price-display"
import { PropertyImageGallery } from "@/components/site/property-image-gallery"
import { VirtualTourButton } from "@/components/site/virtual-tour-button"
import { formatPropertyType } from "@/lib/format"
import { getSession } from "@/lib/auth-session"
import { getAvailablePropertyById } from "@/lib/properties"
import {
  breadcrumbJsonLd,
  listingJsonLd,
  listingPath,
  listingSeoCopy,
  buildPageMetadata,
  parseListingSegment,
  slugify,
} from "@/lib/seo"
import { MediaType, PropertyStatus } from "@/lib/domain-enums"

export const revalidate = 120

type PageProps = {
  params: Promise<{ segment: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segment } = await params
  const parsed = parseListingSegment(segment)
  if (!parsed) {
    return buildPageMetadata({
      title: "Annonce introuvable",
      description: "Cette annonce n’existe pas ou n’est plus disponible.",
      path: `/annonces/${segment}`,
      index: false,
    })
  }

  const property = await getAvailablePropertyById(parsed.id)
  if (!property || property.status !== PropertyStatus.AVAILABLE) {
    return buildPageMetadata({
      title: "Annonce indisponible",
      description: "Cette annonce n’est plus proposée au public.",
      path: listingPath("annonce", parsed.id),
      index: false,
    })
  }

  const copy = listingSeoCopy(property)
  const image =
    property.media.find((media) => media.type === MediaType.IMAGE)?.url ?? null

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: listingPath(property.title, property.id),
    index: true,
    image,
    type: "article",
  })
}

export default async function ListingPage({ params }: PageProps) {
  const { segment } = await params
  const parsed = parseListingSegment(segment)
  if (!parsed) notFound()

  const session = await getSession()
  const property = await getAvailablePropertyById(parsed.id, session?.user.id)
  if (!property) notFound()

  const canonicalSlug = slugify(property.title)
  if (parsed.slug !== canonicalSlug) {
    permanentRedirect(listingPath(property.title, property.id))
  }

  const available = property.status === PropertyStatus.AVAILABLE
  const images = property.media
    .filter((media) => media.type === MediaType.IMAGE)
    .map((media) => ({
      id: media.id,
      url: media.url,
      room: media.room,
      sortOrder: media.sortOrder,
    }))
  const virtualTour = property.media.find(
    (media) => media.type === MediaType.VIRTUAL_TOUR,
  )
  const cover = images[0]?.url ?? null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-10 lg:py-14 lg:pb-14">
      {available ? (
        <>
          <JsonLd
            data={breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Locations", path: "/locations" },
              {
                name: property.title,
                path: listingPath(property.title, property.id),
              },
            ])}
          />
          <JsonLd
            data={listingJsonLd({
              id: property.id,
              title: property.title,
              description: property.description,
              type: property.type,
              location: property.location,
              price: property.price,
              imageUrl: cover,
              updatedAt: property.updatedAt,
              available: true,
            })}
          />
        </>
      ) : null}

      <nav
        aria-label="Fil d’Ariane"
        className="mb-4 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-foreground">
              Accueil
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/locations" className="hover:text-foreground">
              Locations
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="line-clamp-1 text-foreground">{property.title}</li>
        </ol>
      </nav>

      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/" />}
        className="mb-4 -ml-2 min-h-11 sm:mb-6"
      >
        ← Retour à la recherche
      </Button>

      {available ? null : (
        <p className="mb-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Cette annonce n’est plus visible par les visiteurs.{" "}
          <Link href="/locations" className="underline underline-offset-2">
            Voir d’autres logements
          </Link>
          .
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
            <Badge variant="info">{formatPropertyType(property.type)}</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {property.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{property.location}</p>
          </div>

          <PriceDisplay amount={property.price} size="xl" />

          <ListingGrowthActions
            propertyId={property.id}
            propertyTitle={property.title}
            available={available}
            isAuthenticated={Boolean(session)}
          />

          <ListingSafetyNotice />

          <p className="leading-relaxed text-foreground/90">
            {property.description}
          </p>

          {property.features.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3">
              {property.features.map((feature) => (
                <div
                  key={feature.id}
                  className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--elevation-sm)]"
                >
                  <dt className="text-xs text-muted-foreground">
                    {feature.name}
                  </dt>
                  <dd className="font-medium">{feature.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {property.agency ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--elevation-sm)]">
              <p className="text-sm text-muted-foreground">Proposé par</p>
              <p className="font-medium">{property.agency.name}</p>
              {property.agency.phone ? (
                <p className="mt-1 text-sm">{property.agency.phone}</p>
              ) : null}
            </div>
          ) : null}

          <ListingReportForm
            listingId={property.id}
            isAuthenticated={Boolean(session)}
            returnPath={listingPath(property.title, property.id)}
          />

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
              <ListingContactBar
                propertyId={property.id}
                propertyTitle={property.title}
                price={property.price}
                isAuthenticated={Boolean(session)}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
