import Link from "next/link"

import { EmptyState } from "@/components/site/empty-state"
import { PropertyCard } from "@/components/site/property-card"
import type { PropertyListItem } from "@/lib/properties"

export function CatalogResults({
  title,
  description,
  properties,
  emptyHint,
  related,
}: {
  title: string
  description: string
  properties: PropertyListItem[]
  emptyHint: string
  related?: readonly { href: string; label: string }[]
}) {
  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <header className="mb-6 max-w-3xl sm:mb-8">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          Mon Appart
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {properties.length} annonce{properties.length > 1 ? "s" : ""}{" "}
          disponible{properties.length > 1 ? "s" : ""}
        </p>
      </header>

      {properties.length === 0 ? (
        <EmptyState
          title={emptyHint}
          description="Revenez plus tard ou élargissez votre recherche."
          actions={[
            { href: "/", label: "Toutes les annonces", variant: "default" },
            { href: "/locations", label: "Locations", variant: "outline" },
            ...(related?.slice(0, 2).map((item) => ({
              href: item.href,
              label: item.label,
              variant: "outline" as const,
            })) ?? []),
          ]}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {properties.map((property, index) => (
            <li key={property.id}>
              <PropertyCard property={property} priority={index < 3} />
            </li>
          ))}
        </ul>
      )}

      {related && related.length > 0 ? (
        <nav
          aria-label="Catégories proches"
          className="mt-12 border-t border-border pt-8"
        >
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Continuer votre recherche
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </main>
  )
}
