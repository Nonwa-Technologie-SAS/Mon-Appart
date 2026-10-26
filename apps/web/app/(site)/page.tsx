import type { Metadata } from "next"

import { SearchResultsLayout } from "@/components/site/search-results-layout"
import { getSession } from "@/lib/auth-session"
import { searchAvailableProperties } from "@/lib/properties"
import {
  buildPageMetadata,
  decideHomeSearchIndexability,
  DEFAULT_DESCRIPTION,
} from "@/lib/seo"

type HomeParams = {
  q?: string
  type?: string
  maxPrice?: string
  lat?: string
  lng?: string
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeParams>
}): Promise<Metadata> {
  const params = await searchParams
  const decision = decideHomeSearchIndexability(params)

  if (decision.index) {
    return buildPageMetadata({
      title: "Logements à louer en Côte d’Ivoire",
      description: DEFAULT_DESCRIPTION,
      path: "/",
      index: true,
    })
  }

  return buildPageMetadata({
    title: "Résultats de recherche",
    description:
      "Résultats filtrés de la recherche Mon Appart. La page catalogue correspondante reste l’URL de référence pour les moteurs.",
    path: decision.canonicalPath,
    index: false,
  })
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeParams>
}) {
  const params = await searchParams
  const [properties, session] = await Promise.all([
    searchAvailableProperties(params),
    getSession(),
  ])
  const hasFilters = Boolean(params.q || params.type || params.maxPrice)

  return (
    <main className="flex flex-1 flex-col bg-background">
      <SearchResultsLayout
        properties={properties}
        hasFilters={hasFilters}
        initialQ={params.q}
        initialType={params.type}
        initialMaxPrice={params.maxPrice}
        initialLat={params.lat}
        initialLng={params.lng}
        signedIn={Boolean(session)}
      />
    </main>
  )
}
