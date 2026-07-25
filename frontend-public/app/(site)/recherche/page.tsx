import { HeroSearch } from "@/components/site/hero-search"
import { PropertyGrid } from "@/components/site/property-grid"
import { searchAvailableProperties } from "@/lib/properties"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; maxPrice?: string }>
}) {
  const params = await searchParams
  const properties = await searchAvailableProperties(params)
  const hasFilters = Boolean(params.q || params.type || params.maxPrice)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Rechercher un bien
        </h1>
        <p className="mt-2 text-muted-foreground">
          Filtrez par ville, type de logement et budget.
        </p>
      </div>

      <HeroSearch
        compact
        initialQ={params.q}
        initialType={params.type}
        initialMaxPrice={params.maxPrice}
      />

      <div className="mt-10">
        <p className="mb-4 text-sm text-muted-foreground">
          {properties.length} résultat{properties.length > 1 ? "s" : ""}
          {hasFilters ? " pour votre recherche" : ""}
        </p>
        <PropertyGrid properties={properties} />
      </div>
    </main>
  )
}
