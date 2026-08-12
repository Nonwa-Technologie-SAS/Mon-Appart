import { SearchResultsLayout } from "@/components/site/search-results-layout"
import { searchAvailableProperties } from "@/lib/properties"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    type?: string
    maxPrice?: string
    lat?: string
    lng?: string
  }>
}) {
  const params = await searchParams
  const properties = await searchAvailableProperties(params)
  const hasFilters = Boolean(params.q || params.type || params.maxPrice)

  return (
    <main className="flex flex-1 flex-col bg-[#f8f9fa]">
      <SearchResultsLayout
        properties={properties}
        hasFilters={hasFilters}
        initialQ={params.q}
        initialType={params.type}
        initialMaxPrice={params.maxPrice}
        initialLat={params.lat}
        initialLng={params.lng}
      />
    </main>
  )
}
