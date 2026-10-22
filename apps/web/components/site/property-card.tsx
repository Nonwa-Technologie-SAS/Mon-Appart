import Link from "next/link"
import { BathIcon, BedDoubleIcon, RulerIcon } from "lucide-react"

import type { PropertyListItem } from "@/lib/properties"
import { Badge } from "@/components/ui/badge"
import { PriceDisplay } from "@/components/site/price-display"
import { PropertyPhoto } from "@/components/site/property-photo"
import {
  formatPropertyType,
  formatRelativeTime,
} from "@/lib/format"
import { formatDistanceKm } from "@/lib/geo"
import { listingPath } from "@/lib/seo/paths"
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
        href={listingPath(property.title, property.id)}
        className={cn(
          "group flex overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-sm)] transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          highlighted
            ? "border-primary elevation-md"
            : "border-border hover:border-primary/40"
        )}
      >
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-muted sm:w-36">
          <PropertyPhoto
            src={property.imageUrl}
            alt={`Photo — ${property.title}`}
            fill
            sizes="144px"
            quality={85}
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
          <PriceDisplay amount={property.price} size="sm" />
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">
            {property.title}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {property.location}
            <span className="text-muted-foreground/80">
              {" "}
              · {formatPropertyType(property.type)}
            </span>
          </p>
          {property.distanceKm != null ? (
            <p className="text-xs font-medium text-primary">
              à {formatDistanceKm(property.distanceKm)}
            </p>
          ) : null}
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
      href={listingPath(property.title, property.id)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-sm)] transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        highlighted
          ? "border-primary elevation-md"
          : "border-border hover:border-primary/40 hover:shadow-[var(--elevation-md)]"
      )}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-muted">
        <PropertyPhoto
          src={property.imageUrl}
          alt={`Photo — ${property.title}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          quality={85}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="object-cover transition-transform duration-[var(--motion-normal)] group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <Badge>{formatPropertyType(property.type)}</Badge>
          <Badge variant="muted">{formatRelativeTime(property.createdAt)}</Badge>
          {property.distanceKm != null ? (
            <Badge variant="secondary">
              {formatDistanceKm(property.distanceKm)}
            </Badge>
          ) : null}
        </div>
      </div>

      {specs.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
          {specs.map((spec) => (
            <span key={spec.label} className="inline-flex items-center gap-1.5">
              <spec.icon className="size-3.5 text-primary" aria-hidden />
              {spec.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 px-3 py-3 sm:px-4 sm:py-4">
        <PriceDisplay amount={property.price} />
        <p className="truncate font-semibold text-foreground">{property.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {property.location}
        </p>
      </div>
    </Link>
  )
}
