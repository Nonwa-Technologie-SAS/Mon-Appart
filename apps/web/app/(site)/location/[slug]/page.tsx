import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CatalogResults } from "@/components/seo/catalog-results"
import { JsonLd } from "@/components/seo/json-ld"
import { searchAvailableProperties } from "@/lib/properties"
import { findLocationBySlug, listableDestinations } from "@/lib/seo/catalog"
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  locationPath,
} from "@/lib/seo"

export const revalidate = 300

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const facet = await findLocationBySlug(slug)
  if (!facet) {
    return buildPageMetadata({
      title: "Localisation introuvable",
      description: "Aucune annonce pour cette localisation.",
      path: `/location/${slug}`,
      index: false,
    })
  }
  return buildPageMetadata({
    title: `Logements à louer à ${facet.location}`,
    description: `${facet.count} annonce${facet.count > 1 ? "s" : ""} disponible${facet.count > 1 ? "s" : ""} à ${facet.location} sur Mon Appart.`,
    path: locationPath(facet.location),
    index: true,
  })
}

export default async function LocationPage({ params }: PageProps) {
  const { slug } = await params
  const facet = await findLocationBySlug(slug)
  if (!facet) notFound()

  const [properties, destinations] = await Promise.all([
    searchAvailableProperties({ locationExact: facet.location }),
    listableDestinations(),
  ])

  if (properties.length === 0) notFound()

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Locations", path: "/locations" },
          { name: facet.location, path: locationPath(facet.location) },
        ])}
      />
      <CatalogResults
        title={`Logements à louer à ${facet.location}`}
        description={`Annonces publiées pour « ${facet.location} ». Les localisations affichées correspondent aux textes saisis par les annonceurs.`}
        properties={properties}
        emptyHint="Aucune annonce pour cette localisation."
        related={[
          { href: "/locations", label: "Toutes les locations" },
          ...destinations
            .filter((item) => item.path !== "/locations")
            .slice(0, 4)
            .map((item) => ({ href: item.path, label: item.title })),
        ]}
      />
    </>
  )
}
