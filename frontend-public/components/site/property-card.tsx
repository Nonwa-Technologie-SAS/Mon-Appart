import Image from "next/image"
import Link from "next/link"

import type { PropertyListItem } from "@/lib/properties"
import { formatPrice, formatPropertyType } from "@/lib/format"

export function PropertyCard({ property }: { property: PropertyListItem }) {
  return (
    <Link
      href={`/biens/${property.id}`}
      className="group property-card flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {property.imageUrl ? (
          <Image
            src={property.imageUrl}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Photo à venir
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          {formatPropertyType(property.type)}
        </p>
        <h3 className="line-clamp-2 font-heading text-lg leading-snug font-semibold">
          {property.title}
        </h3>
        <p className="text-sm text-muted-foreground">{property.location}</p>
        <p className="mt-auto pt-2 text-base font-semibold">
          {formatPrice(property.price)}
          <span className="text-sm font-normal text-muted-foreground"> / mois</span>
        </p>
      </div>
    </Link>
  )
}
