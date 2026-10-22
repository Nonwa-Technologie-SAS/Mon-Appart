import type { Metadata } from "next"

import { CatalogResults } from "@/components/seo/catalog-results"
import { JsonLd } from "@/components/seo/json-ld"
import { searchAvailableProperties } from "@/lib/properties"
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  destinationByPath,
} from "@/lib/seo"

const dest = destinationByPath("/terrains")!

export const revalidate = 300

export const metadata: Metadata = buildPageMetadata({
  title: dest.title,
  description: dest.description,
  path: dest.path,
})

export default async function LandPage() {
  const properties = await searchAvailableProperties({ type: "LAND" })
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: dest.title, path: dest.path },
        ])}
      />
      <CatalogResults
        title={dest.title}
        description={dest.description}
        properties={properties}
        emptyHint="Aucun terrain publié pour le moment."
        related={[
          { href: "/locations", label: "Locations" },
          { href: "/maisons-a-louer", label: "Maisons à louer" },
        ]}
      />
    </>
  )
}
