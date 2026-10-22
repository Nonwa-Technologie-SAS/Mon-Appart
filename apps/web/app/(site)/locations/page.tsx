import type { Metadata } from "next"

import { CatalogResults } from "@/components/seo/catalog-results"
import { JsonLd } from "@/components/seo/json-ld"
import { searchAvailableProperties } from "@/lib/properties"
import { listableDestinations } from "@/lib/seo/catalog"
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  destinationByPath,
} from "@/lib/seo"

const dest = destinationByPath("/locations")!

export const revalidate = 300

export const metadata: Metadata = buildPageMetadata({
  title: dest.title,
  description: dest.description,
  path: dest.path,
})

export default async function LocationsPage() {
  const [properties, destinations] = await Promise.all([
    searchAvailableProperties({}),
    listableDestinations(),
  ])

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Locations", path: "/locations" },
        ])}
      />
      <CatalogResults
        title={dest.title}
        description={dest.description}
        properties={properties}
        emptyHint="Aucune location n’est publiée pour le moment."
        related={destinations
          .filter((item) => item.path !== "/locations")
          .slice(0, 6)
          .map((item) => ({ href: item.path, label: item.title }))}
      />
    </>
  )
}
