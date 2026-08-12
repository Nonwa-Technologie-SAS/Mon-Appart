import Image from "next/image"
import Link from "next/link"
import { BathIcon, BedDoubleIcon, RulerIcon } from "lucide-react"

import type { PropertyListItem } from "@/lib/properties"
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
}: {
  property: PropertyListItem
  compact?: boolean
  highlighted?: boolean
}) {
  if (compact) {
    return (
      <Link
        href={`/biens/${property.id}`}
        className={cn(
          "group property-card flex overflow-hidden rounded-2xl border bg-card transition-[transform,box-shadow,border-color] duration-300",
          highlighted
            ? "border-primary shadow-md"
            : "border-border hover:-translate-y-0.5 hover:shadow-md"
        )}
      >
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden bg-muted sm:w-36">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={property.title}
              fill
              sizes="144px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Photo à venir
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {formatPropertyType(property.type)}
          </p>
          <h3 className="line-clamp-2 font-heading text-base leading-snug font-semibold">
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
            <span className="text-sm font-normal text-muted-foreground"> / mois</span>
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
        "group property-card flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgb(0,0,0,0.1)]",
        highlighted && "ring-2 ring-primary/40"
      )}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-muted">
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
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="rounded-lg border border-white/70 bg-white/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            {formatPropertyType(property.type)}
          </span>
          <span className="rounded-lg border border-white/70 bg-white/95 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            {formatRelativeTime(property.createdAt)}
          </span>
          {property.distanceKm != null ? (
            <span className="rounded-lg border border-white/70 bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
              {formatDistanceKm(property.distanceKm)}
            </span>
          ) : null}
        </div>
      </div>

      {specs.length > 0 ? (
        <div className="flex items-center gap-4 bg-muted/70 px-4 py-2.5 text-sm text-muted-foreground">
          {specs.map((spec) => (
            <span key={spec.label} className="inline-flex items-center gap-1.5">
              <spec.icon className="size-3.5" />
              {spec.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3 px-4 py-4">
        <p className="text-2xl font-semibold tracking-tight">
          {formatPrice(property.price)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            / mois
          </span>
        </p>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-medium">{property.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {property.location}
          </p>
        </div>
      </div>
    </Link>
  )
}
