"use client"

import {
  LayoutGridIcon,
  ListIcon,
  Table2Icon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { OwnedPropertyActions } from "@/components/espace/owned-property-actions"
import { PriceDisplay } from "@/components/site/price-display"
import { PropertyCard } from "@/components/site/property-card"
import { PropertyPhoto } from "@/components/site/property-photo"
import { PropertyStatus } from "@/lib/domain-enums"
import {
  formatPropertyStatus,
  formatPropertyType,
} from "@/lib/format"
import type { OwnerPropertyListItem } from "@/lib/properties"
import { listingPath } from "@/lib/seo/paths"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list" | "table"

const STORAGE_KEY = "espacePropertiesView:v2"

const VIEW_OPTIONS: ReadonlyArray<{
  id: ViewMode
  label: string
  icon: LucideIcon
}> = [
  { id: "table", label: "Tableau", icon: Table2Icon },
  { id: "list", label: "Liste", icon: ListIcon },
  { id: "grid", label: "Grille", icon: LayoutGridIcon },
]

function readStoredView(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "grid" || stored === "list" || stored === "table") {
      return stored
    }
  } catch {
    // localStorage indisponible
  }
  return "table"
}

export function OwnedPropertiesPanel({
  properties,
}: {
  properties: OwnerPropertyListItem[]
}) {
  const [view, setView] = useState<ViewMode>("table")

  useEffect(() => {
    setView(readStoredView())
  }, [])

  function changeView(next: ViewMode) {
    setView(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {properties.length} annonce{properties.length > 1 ? "s" : ""}
        </p>
        <div
          role="group"
          aria-label="Mode d'affichage"
          className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm"
        >
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon
            const active = view === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => changeView(option.id)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {view === "grid" ? <GridView properties={properties} /> : null}
      {view === "list" ? <ListView properties={properties} /> : null}
      {view === "table" ? <TableView properties={properties} /> : null}
    </div>
  )
}

function GridView({ properties }: { properties: OwnerPropertyListItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {properties.map((property) => {
        const available = property.status === PropertyStatus.AVAILABLE
        return (
          <div key={property.id} className="flex min-w-0 flex-col gap-2">
            <div className="relative min-w-0">
              <div className={available ? undefined : "opacity-70"}>
                <PropertyCard property={property} compact />
              </div>
              <StatusBadge status={property.status} available={available} />
            </div>
            <OwnedPropertyActions
              listingId={property.id}
              status={property.status}
              layout="stack"
            />
          </div>
        )
      })}
    </div>
  )
}

function ListView({ properties }: { properties: OwnerPropertyListItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {properties.map((property) => {
        const available = property.status === PropertyStatus.AVAILABLE
        return (
          <li
            key={property.id}
            className={cn(
              "overflow-hidden rounded-xl border border-border bg-card shadow-[var(--elevation-sm)]",
              !available && "opacity-80",
            )}
          >
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
              <Link
                href={listingPath(property.title, property.id)}
                className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:aspect-square sm:w-36"
              >
                <PropertyPhoto
                  src={property.imageUrl}
                  alt={`Photo — ${property.title}`}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
                <StatusBadge status={property.status} available={available} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="min-w-0">
                  <PriceDisplay amount={property.price} size="sm" />
                  <Link
                    href={listingPath(property.title, property.id)}
                    className="mt-1 line-clamp-2 text-base font-semibold hover:underline"
                  >
                    {property.title}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {property.location} · {formatPropertyType(property.type)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[property.beds && `${property.beds} ch.`, property.baths && `${property.baths} sdb`, property.surface]
                      .filter(Boolean)
                      .join(" · ") || "Caractéristiques non renseignées"}
                  </p>
                </div>
                <div className="mt-auto">
                  <OwnedPropertyActions
                    listingId={property.id}
                    status={property.status}
                    layout="toolbar"
                  />
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TableView({ properties }: { properties: OwnerPropertyListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-3 py-3 font-semibold">
              Bien
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Prix
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Statut
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {properties.map((property) => {
            const available = property.status === PropertyStatus.AVAILABLE
            return (
              <tr key={property.id} className="align-top">
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Link
                      href={listingPath(property.title, property.id)}
                      className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted"
                    >
                      <PropertyPhoto
                        src={property.imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={listingPath(property.title, property.id)}
                        className="line-clamp-2 font-semibold hover:underline"
                      >
                        {property.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {property.location} ·{" "}
                        {formatPropertyType(property.type)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <PriceDisplay amount={property.price} size="sm" />
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                      available
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatPropertyStatus(property.status)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <OwnedPropertyActions
                    listingId={property.id}
                    status={property.status}
                    layout="toolbar"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({
  status,
  available,
}: {
  status: PropertyStatus
  available: boolean
}) {
  return (
    <span
      className={cn(
        "absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-medium",
        available
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {formatPropertyStatus(status)}
    </span>
  )
}
