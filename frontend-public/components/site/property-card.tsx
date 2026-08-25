import Link from "next/link"
import { BathIcon, BedDoubleIcon, RulerIcon } from "lucide-react"

import type { PropertyListItem } from "@/lib/properties"
import { PropertyPhoto } from "@/components/site/property-photo"
import {
  formatPrice,
  formatPropertyType,
  formatRelativeTime,
} from "@/lib/format"
import { formatDistanceKm } from "@/lib/geo"
import { cn } from "@/lib/utils"

export function PropertyCard({
  property,
  compact = false,
  highlighted = false,
  priority = false,
}: {
  property: PropertyListItem
  compact?: boolean
  highlighted?: boolean
  priority?: boolean
}) {
  if (compact) {
    return (
      <Link
        href={`/biens/${property.id}`}
        className={cn(
          "group flex overflow-hidden rounded-xl border bg-card transition-colors",
          highlighted
            ? "border-primary"
            : "border-border hover:border-primary/40"
        )}
      >
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-muted sm:w-36">
          <PropertyPhoto
            src={property.imageUrl}
            alt={property.title}
            fill
            sizes="144px"
            quality={85}
            loading={priority ? "eager" : "lazy"}
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
          <p className="text-xs font-medium text-primary">
            {formatPropertyType(property.type)}
          </p>
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">
            {property.title}
          </h3>
          <p className="text-sm text-muted-foreground">{property.location}</p>
          {property.distanceKm != null ? (
            <p className="text-xs font-medium text-primary">
              à {formatDistanceKm(property.distanceKm)}
            </p>
          ) : null}
          <p className="mt-auto pt-1 text-sm font-semibold">
            {formatPrice(property.price)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / mois
            </span>
          </p>
        </div>
      </Link>
    )
  }

  const specs = [
    property.beds
      ? { icon: BedDoubleIcon, label: `${property.beds} ch.` }
      : null,
    property.baths
      ? { icon: BathIcon, label: `${property.baths} sdb` }
      : null,
    property.surface
      ? { icon: RulerIcon, label: property.surface }
      : null,
  ].filter(Boolean) as { icon: typeof BedDoubleIcon; label: string }[]

  return (
    <Link
      href={`/biens/${property.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
        highlighted ? "border-primary" : "border-border hover:border-primary/40"
      )}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-muted">
        <PropertyPhoto
          src={property.imageUrl}
          alt={property.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          quality={85}
          loading={priority ? "eager" : "lazy"}
          className="object-cover"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            {formatPropertyType(property.type)}
          </span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {formatRelativeTime(property.createdAt)}
          </span>
          {property.distanceKm != null ? (
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {formatDistanceKm(property.distanceKm)}
            </span>
          ) : null}
        </div>
      </div>

      {specs.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
          {specs.map((spec) => (
            <span key={spec.label} className="inline-flex items-center gap-1.5">
              <spec.icon className="size-3.5 text-primary" />
              {spec.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 px-3 py-3 sm:px-4 sm:py-4">
        <p className="truncate font-semibold">{property.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {property.location}
        </p>
        <p className="mt-2 text-lg font-bold text-primary sm:text-xl">
          {formatPrice(property.price)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            / mois
          </span>
        </p>
      </div>
    </Link>
  )
}
