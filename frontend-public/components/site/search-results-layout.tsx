"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { InfoIcon, LocateFixedIcon } from "lucide-react"

import type { PropertyListItem } from "@/lib/properties"
import { PropertyCard } from "@/components/site/property-card"
import { HeroSearch } from "@/components/site/hero-search"
import { useVisitorLocation } from "@/components/site/use-visitor-location"
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"
import { AROUND_RADIUS_KM, NEARBY_RADIUS_KM, haversineKm } from "@/lib/geo"
import { cn } from "@/lib/utils"

const PropertyMap = dynamic(
  () =>
    import("@/components/site/property-map").then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Chargement de la carte…
      </div>
    ),
  }
)

type SearchResultsLayoutProps = {
  properties: PropertyListItem[]
  hasFilters: boolean
  initialQ?: string
  initialType?: string
  initialMaxPrice?: string
  initialLat?: string
  initialLng?: string
}

function withClientDistance(
  properties: PropertyListItem[],
  lat: number | null,
  lng: number | null
) {
  if (lat == null || lng == null) return properties

  return properties.map((property) => {
    if (property.distanceKm != null) return property
    if (property.latitude == null || property.longitude == null) return property
    return {
      ...property,
      distanceKm: haversineKm(
        { lat, lng },
        { lat: property.latitude, lng: property.longitude }
      ),
    }
  })
}

export function SearchResultsLayout({
  properties,
  hasFilters,
  initialQ,
  initialType,
  initialMaxPrice,
  initialLat,
  initialLng,
}: SearchResultsLayoutProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [familyMode, setFamilyMode] = useState(true)
  const [sort, setSort] = useState(initialLat && initialLng ? "distance" : "newest")
  const geoEnabled = !initialQ?.trim()
  const location = useVisitorLocation({
    enabled: geoEnabled,
    initialLat,
    initialLng,
  })

  useEffect(() => {
    if (location.status === "ready") {
      setSort((current) => (current === "newest" ? "distance" : current))
    }
  }, [location.status])

  const locatedProperties = useMemo(
    () => withClientDistance(properties, location.lat, location.lng),
    [location.lat, location.lng, properties]
  )

  const sortedProperties = useMemo(() => {
    return [...locatedProperties].toSorted((a, b) => {
      if (sort === "price-asc") return a.price - b.price
      if (sort === "price-desc") return b.price - a.price
      if (sort === "distance" || (sort === "newest" && location.status === "ready")) {
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [locatedProperties, location.status, sort])

  const nearby = sortedProperties.filter(
    (property) => property.distanceKm != null && property.distanceKm <= NEARBY_RADIUS_KM
  )
  const around = sortedProperties.filter(
    (property) =>
      property.distanceKm != null &&
      property.distanceKm > NEARBY_RADIUS_KM &&
      property.distanceKm <= AROUND_RADIUS_KM
  )
  const further = sortedProperties.filter(
    (property) => property.distanceKm == null || property.distanceKm > AROUND_RADIUS_KM
  )

  const showGeoGroups =
    geoEnabled &&
    location.status === "ready" &&
    (sort === "distance" || sort === "newest")

  const locationLabel = initialQ?.trim()
    ? initialQ.trim()
    : location.city
      ? location.city
      : location.status === "ready"
        ? "votre position"
        : "toute la France"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/70 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <p className="shrink-0 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {sortedProperties.length} résultat
                {sortedProperties.length > 1 ? "s" : ""}
              </span>
              {hasFilters ? " pour votre recherche" : ` autour de ${locationLabel}`}
            </p>
            <HeroSearch
              key={`${initialQ ?? ""}-${initialType ?? ""}-${initialMaxPrice ?? ""}`}
              compact
              initialQ={initialQ}
              initialType={initialType}
              initialMaxPrice={initialMaxPrice}
            />
          </div>

          {geoEnabled && location.status === "prompting" ? (
            <p className="text-sm text-muted-foreground">
              Localisation en cours pour afficher les biens près de chez vous…
            </p>
          ) : null}

          {geoEnabled && (location.status === "denied" || location.status === "unavailable") ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                Activez la localisation pour voir les maisons disponibles dans votre zone.
              </p>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                onClick={location.requestLocation}
              >
                <LocateFixedIcon data-icon="inline-start" />
                Autour de moi
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              <button
                type="button"
                role="switch"
                aria-checked={familyMode}
                onClick={() => setFamilyMode((current) => !current)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  familyMode ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                    familyMode && "translate-x-5"
                  )}
                />
              </button>
              Mode famille
              <InfoIcon className="size-3.5" />
            </label>

            <label className="inline-flex items-center gap-2 text-muted-foreground">
              <button
                type="button"
                role="switch"
                aria-checked={showMap}
                onClick={() => setShowMap((current) => !current)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  showMap ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                    showMap && "translate-x-5"
                  )}
                />
              </button>
              Vue carte
            </label>

            {location.status === "ready" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={location.requestLocation}
              >
                <LocateFixedIcon data-icon="inline-start" />
                Ma position
              </Button>
            ) : null}

            <label className="ml-auto inline-flex items-center gap-2 text-muted-foreground">
              Trier par
              <NativeSelect
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-9 w-40 rounded-full border-border bg-white px-3"
              >
                {location.status === "ready" ? (
                  <option value="distance">Distance</option>
                ) : null}
                <option value="newest">Plus récents</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
              </NativeSelect>
            </label>
          </div>
        </div>
      </div>

      {showMap ? (
        <div className="relative flex min-h-[70vh] flex-1">
          <section className="flex w-full flex-col border-border lg:w-[42%] lg:max-w-xl lg:border-r xl:w-[38%]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <PropertyList
                properties={sortedProperties}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
                compact
              />
            </div>
          </section>
          <section className="relative hidden min-h-0 flex-1 lg:block">
            <PropertyMap
              properties={sortedProperties}
              highlightedId={highlightedId}
              onMarkerHover={setHighlightedId}
            />
          </section>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 py-8 sm:px-6">
          {showGeoGroups ? (
            <>
              <PropertySection
                title="Dans votre zone"
                subtitle={`Biens à moins de ${NEARBY_RADIUS_KM} km`}
                properties={nearby}
                emptyMessage="Aucun bien disponible dans un rayon proche. Voici les alentours ci-dessous."
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
              />
              <PropertySection
                title="Aux alentours"
                subtitle={`Jusqu’à ${AROUND_RADIUS_KM} km autour de vous`}
                properties={around}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
              />
              {further.length > 0 ? (
                <PropertySection
                  title="Plus loin"
                  subtitle="D’autres annonces disponibles"
                  properties={further}
                  highlightedId={highlightedId}
                  onHighlight={setHighlightedId}
                />
              ) : null}
            </>
          ) : (
            <PropertyList
              properties={sortedProperties}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PropertySection({
  title,
  subtitle,
  properties,
  emptyMessage,
  highlightedId,
  onHighlight,
}: {
  title: string
  subtitle: string
  properties: PropertyListItem[]
  emptyMessage?: string
  highlightedId: string | null
  onHighlight: (id: string | null) => void
}) {
  if (properties.length === 0 && !emptyMessage) return null

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {properties.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <PropertyList
          properties={properties}
          highlightedId={highlightedId}
          onHighlight={onHighlight}
        />
      )}
    </section>
  )
}

function PropertyList({
  properties,
  highlightedId,
  onHighlight,
  compact = false,
}: {
  properties: PropertyListItem[]
  highlightedId: string | null
  onHighlight: (id: string | null) => void
  compact?: boolean
}) {
  if (properties.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center text-muted-foreground">
        Aucun bien disponible pour ces critères.
      </p>
    )
  }

  return (
    <ul
      className={
        compact
          ? "flex flex-col gap-4"
          : "grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {properties.map((property) => (
        <li
          key={property.id}
          onMouseEnter={() => onHighlight(property.id)}
          onMouseLeave={() => onHighlight(null)}
        >
          <PropertyCard
            property={property}
            compact={compact}
            highlighted={highlightedId === property.id}
          />
        </li>
      ))}
    </ul>
  )
}
