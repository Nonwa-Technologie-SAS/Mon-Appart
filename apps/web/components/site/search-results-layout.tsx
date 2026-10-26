"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { LocateFixedIcon } from "lucide-react"

import type { PropertyListItem } from "@/lib/properties"
import { CategoryShortcuts } from "@/components/site/category-shortcuts"
import { EmptyState } from "@/components/site/empty-state"
import { HeroSearch, PillSelect } from "@/components/site/hero-search"
import { PropertyCard } from "@/components/site/property-card"
import { SaveSearchCriteria } from "@/components/site/save-search-criteria"
import { PublisherCta } from "@/components/site/publisher-cta"
import { TrustStrip } from "@/components/site/trust-strip"
import { useVisitorLocation } from "@/components/site/use-visitor-location"
import { Button } from "@/components/ui/button"
import { AROUND_RADIUS_KM, NEARBY_RADIUS_KM, haversineKm } from "@/lib/geo"
import { cn } from "@/lib/utils"

const PropertyMap = dynamic(
  () => import("@/components/site/property-map").then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full min-h-[12rem] items-center justify-center bg-muted text-sm text-muted-foreground">
        Chargement de la carte…
      </div>
    ),
  },
)

type SearchResultsLayoutProps = {
  properties: PropertyListItem[]
  hasFilters: boolean
  initialQ?: string
  initialType?: string
  initialMaxPrice?: string
  initialLat?: string
  initialLng?: string
  signedIn?: boolean
}

function withClientDistance(
  properties: PropertyListItem[],
  lat: number | null,
  lng: number | null,
) {
  if (lat == null || lng == null) return properties

  return properties.map((property) => {
    if (property.distanceKm != null) return property
    if (property.latitude == null || property.longitude == null) return property
    return {
      ...property,
      distanceKm: haversineKm(
        { lat, lng },
        { lat: property.latitude, lng: property.longitude },
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
  signedIn = false,
}: SearchResultsLayoutProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [sort, setSort] = useState(
    initialLat && initialLng ? "distance" : "newest",
  )
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
    [location.lat, location.lng, properties],
  )

  const sortedProperties = useMemo(() => {
    return [...locatedProperties].toSorted((a, b) => {
      if (sort === "price-asc") return a.price - b.price
      if (sort === "price-desc") return b.price - a.price
      if (
        sort === "distance" ||
        (sort === "newest" && location.status === "ready")
      ) {
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [locatedProperties, location.status, sort])

  const nearby = sortedProperties.filter(
    (property) =>
      property.distanceKm != null && property.distanceKm <= NEARBY_RADIUS_KM,
  )
  const around = sortedProperties.filter(
    (property) =>
      property.distanceKm != null &&
      property.distanceKm > NEARBY_RADIUS_KM &&
      property.distanceKm <= AROUND_RADIUS_KM,
  )
  const further = sortedProperties.filter(
    (property) =>
      property.distanceKm == null || property.distanceKm > AROUND_RADIUS_KM,
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
        : "Côte d’Ivoire"

  const emptyActions = [
    { href: "/", label: "Effacer les filtres", variant: "default" as const },
    {
      href: "/appartements-a-louer",
      label: "Élargir : appartements",
      variant: "outline" as const,
    },
    {
      href: "/maisons-a-louer",
      label: "Élargir : maisons",
      variant: "outline" as const,
    },
    {
      href: "/terrains",
      label: "Voir les terrains",
      variant: "outline" as const,
    },
    {
      href: "/guides/eviter-les-arnaques",
      label: "Conseils anti-arnaques",
      variant: "outline" as const,
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border surface-hero">
        <div className="container-content flex flex-col gap-4 py-5 sm:gap-5 sm:py-8 lg:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase sm:text-base">
              Mon Appart
            </p>
            <h1 className="text-[1.75rem] leading-tight font-bold sm:text-4xl lg:text-5xl">
              Trouvez votre chez-vous
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Location en Côte d’Ivoire : comparez les annonces, les photos et
              demandez une visite en quelques minutes.
            </p>
          </div>

          {!hasFilters ? <CategoryShortcuts /> : null}

          <HeroSearch
            key={`${initialQ ?? ""}-${initialType ?? ""}-${initialMaxPrice ?? ""}`}
            compact
            initialQ={initialQ}
            initialType={initialType}
            initialMaxPrice={initialMaxPrice}
            leading={
              <p className="shrink-0 text-sm" aria-live="polite">
                <span className="font-semibold text-foreground">
                  {sortedProperties.length} résultat
                  {sortedProperties.length > 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground">
                  {hasFilters
                    ? " pour votre recherche"
                    : ` autour de ${locationLabel}`}
                </span>
              </p>
            }
          />

          {geoEnabled && location.status === "prompting" ? (
            <p className="text-sm text-muted-foreground" role="status">
              Localisation en cours pour afficher les biens près de chez vous…
            </p>
          ) : null}

          {geoEnabled &&
          (location.status === "denied" ||
            location.status === "unavailable") ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm sm:flex-row sm:items-center">
              <p className="flex-1 text-muted-foreground">
                Activez la localisation pour voir les logements près de vous, ou
                saisissez une ville / un quartier.
              </p>
              <Button
                type="button"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={location.requestLocation}
              >
                <LocateFixedIcon data-icon="inline-start" />
                Autour de moi
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="inline-flex min-h-11 items-center gap-2.5 text-muted-foreground">
                <FilterSwitch
                  checked={showMap}
                  onCheckedChange={setShowMap}
                  label="Vue carte"
                />
                Vue carte
              </label>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 rounded-full bg-muted px-4 text-foreground hover:bg-muted/80"
                onClick={location.requestLocation}
              >
                <LocateFixedIcon data-icon="inline-start" />
                Ma position
              </Button>
            </div>

            <label className="inline-flex w-full min-w-0 items-center gap-2 text-muted-foreground sm:ml-auto sm:w-auto">
              <span className="shrink-0">Trier par</span>
              <PillSelect
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="min-h-11 w-full sm:w-40"
              >
                {location.status === "ready" ? (
                  <option value="distance">Distance</option>
                ) : null}
                <option value="newest">Plus récents</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
              </PillSelect>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Astuce :{" "}
            <Link
              href="/guides/eviter-les-arnaques"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              comment éviter les arnaques
            </Link>{" "}
            avant de payer ou d’envoyer des documents.
          </p>
        </div>
      </div>

      {showMap ? (
        <div className="relative flex min-h-0 flex-1 flex-col lg:min-h-[70vh] lg:flex-row">
          <section className="relative h-[min(50dvh,420px)] w-full shrink-0 overflow-hidden lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
            <PropertyMap
              properties={sortedProperties}
              highlightedId={highlightedId}
              onMarkerHover={setHighlightedId}
            />
          </section>
          <section className="flex min-h-0 w-full flex-col border-border lg:order-1 lg:w-[42%] lg:max-w-xl lg:border-r xl:w-[38%]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <PropertyList
                properties={sortedProperties}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
                compact
                emptyActions={hasFilters ? emptyActions : undefined}
                saveCriteria={
                  hasFilters
                    ? {
                        q: initialQ,
                        type: initialType,
                        maxPrice: initialMaxPrice,
                        signedIn,
                      }
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      ) : (
        <div className="container-content flex flex-col gap-8 py-6 sm:gap-10 sm:py-8">
          {!hasFilters ? <TrustStrip /> : null}

          {showGeoGroups ? (
            <>
              <PropertySection
                title="Dans votre zone"
                subtitle={`Biens à moins de ${NEARBY_RADIUS_KM} km`}
                properties={nearby}
                emptyMessage="Aucun bien dans un rayon proche. Voir les alentours ci-dessous."
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
              emptyActions={hasFilters ? emptyActions : undefined}
              saveCriteria={
                hasFilters
                  ? {
                      q: initialQ,
                      type: initialType,
                      maxPrice: initialMaxPrice,
                      signedIn,
                    }
                  : undefined
              }
            />
          )}

          {!hasFilters ? <PublisherCta /> : null}
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
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {properties.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
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
  emptyActions,
  saveCriteria,
}: {
  properties: PropertyListItem[]
  highlightedId: string | null
  onHighlight: (id: string | null) => void
  compact?: boolean
  emptyActions?: readonly {
    href: string
    label: string
    variant?: "default" | "outline" | "secondary"
  }[]
  saveCriteria?: {
    q?: string
    type?: string
    maxPrice?: string
    signedIn?: boolean
  }
}) {
  if (properties.length === 0) {
    return (
      <div>
        <EmptyState
          title="Aucun logement pour ces critères"
          description="Élargissez volontairement un filtre (budget, type, zone) — nous ne modifions pas vos critères à votre place."
          actions={
            emptyActions ?? [
              {
                href: "/",
                label: "Voir toutes les annonces",
                variant: "default",
              },
              { href: "/locations", label: "Locations", variant: "outline" },
            ]
          }
        />
        {saveCriteria ? (
          <SaveSearchCriteria
            q={saveCriteria.q}
            type={saveCriteria.type}
            maxPrice={saveCriteria.maxPrice}
            signedIn={saveCriteria.signedIn}
          />
        ) : null}
      </div>
    )
  }

  return (
    <ul
      className={
        compact
          ? "flex flex-col gap-4"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3"
      }
    >
      {properties.map((property, index) => (
        <li
          key={property.id}
          onMouseEnter={() => onHighlight(property.id)}
          onMouseLeave={() => onHighlight(null)}
        >
          <PropertyCard
            property={property}
            compact={compact}
            highlighted={highlightedId === property.id}
            priority={index === 0}
          />
        </li>
      ))}
    </ul>
  )
}

function FilterSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  )
}
