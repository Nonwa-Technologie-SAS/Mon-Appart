import type { Metadata } from "next"

import { CatalogResults } from "@/components/seo/catalog-results"
import { JsonLd } from "@/components/seo/json-ld"
import { searchAvailableProperties } from "@/lib/properties"
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  destinationByPath,
} from "@/lib/seo"

const dest = destinationByPath("/appartements-a-louer")!

export const revalidate = 300

export const metadata: Metadata = buildPageMetadata({
  title: dest.title,
  description: dest.description,
  path: dest.path,
})

export default async function ApartmentsPage() {
  const properties = await searchAvailableProperties({ type: "APARTMENT" })
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Locations", path: "/locations" },
          { name: dest.title, path: dest.path },
        ])}
      />
      <CatalogResults
        title={dest.title}
        description={dest.description}
        properties={properties}
        emptyHint="Aucun appartement disponible pour le moment."
        related={[
          { href: "/locations", label: "Toutes les locations" },
          { href: "/maisons-a-louer", label: "Maisons à louer" },
          { href: "/studios-a-louer", label: "Studios à louer" },
        ]}
      />
    </>
  )
}
