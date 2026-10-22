"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { formatAge, formatPrice, statusLabel } from "@/lib/format"
import type { ListingQueueItem } from "@/lib/types"
import { usePagedList } from "@/lib/use-api"

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  Table,
  inputClass,
} from "../ui"

const STATUSES = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "SUSPENDED",
  "DRAFT",
  "EXPIRED",
  "ARCHIVED",
]
const TYPES = ["RENT", "SALE", "SHORT_TERM_RENT", "LEASE_TO_OWN"]

interface Filters {
  status: string
  listingType: string
  q: string
}

export function ListingQueue({ initial }: { initial: Partial<Filters> }) {
  const [filters, setFilters] = useState<Filters>({
    status: initial.status ?? "PENDING_REVIEW",
    listingType: initial.listingType ?? "",
    q: initial.q ?? "",
  })
  const list = usePagedList<ListingQueueItem>("/admin/listings", {
    ...filters,
    limit: 25,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      status: String(form.get("status") ?? "PENDING_REVIEW"),
      listingType: String(form.get("listingType") ?? ""),
      q: String(form.get("q") ?? "").trim(),
    })
  }

  return (
    <>
      <PageHeader
        title="Annonces"
        description="Plus anciennes d'abord. Les décisions suivent la machine à états des annonces."
      />
      <form
        onSubmit={onSubmit}
        className="mb-4 flex flex-wrap items-end gap-3"
        role="search"
      >
        <label className="flex flex-col gap-1 text-sm">
          Statut
          <select
            name="status"
            defaultValue={filters.status}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Offre
          <select
            name="listingType"
            defaultValue={filters.listingType}
            className={inputClass}
          >
            <option value="">Toutes</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Titre ou identifiant
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            className={inputClass}
          />
        </label>
        <Button type="submit">Filtrer</Button>
      </form>

      {list.status === "loading" ? <Loading /> : null}
      {list.status === "error" && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" ? (
        list.items.length === 0 ? (
          <EmptyState>
            Aucune annonce avec le statut « {statusLabel(filters.status)} ».
          </EmptyState>
        ) : (
          <>
            <Table
              headers={[
                "Annonce",
                "Statut",
                "Prix",
                "Localisation",
                "Signalements ouverts",
                "En attente depuis",
              ]}
            >
              {list.items.map((listing) => (
                <tr key={listing.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {listing.title}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {listing.property.type.name} · {listing.listingType} ·{" "}
                      {listing.publisher.name ?? "Annonceur sans nom"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={listing.status} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatPrice(listing.price)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {[listing.property.neighborhood, listing.property.commune]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {listing.openReports}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatAge(listing.updatedAt)}
                  </td>
                </tr>
              ))}
            </Table>
            <LoadMore
              hasMore={Boolean(list.nextCursor)}
              loading={list.loadingMore}
              error={list.error}
              onClick={() => void list.loadMore()}
            />
          </>
        )
      ) : null}
    </>
  )
}
