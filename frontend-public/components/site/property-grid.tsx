import type { PropertyListItem } from "@/lib/properties"
import { PropertyCard } from "@/components/site/property-card"

export function PropertyGrid({
  properties,
  emptyMessage = "Aucun bien disponible pour ces critères.",
}: {
  properties: PropertyListItem[]
  emptyMessage?: string
}) {
  if (properties.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {properties.map((property, index) => (
        <PropertyCard
          key={property.id}
          property={property}
          priority={index === 0}
        />
      ))}
    </div>
  )
}
