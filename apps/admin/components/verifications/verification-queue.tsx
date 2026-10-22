"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { formatAge, statusLabel } from "@/lib/format"
import type { VerificationQueueItem } from "@/lib/types"
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
  "PENDING",
  "IN_REVIEW",
  "NEEDS_MORE_INFORMATION",
  "VERIFIED",
  "REJECTED",
  "REVOKED",
]
const TYPES = [
  "IDENTITY",
  "PROPERTY_OWNERSHIP",
  "OWNER_AUTHORIZATION",
  "PROPERTY_DOCUMENT",
  "AGENCY",
  "ADDRESS",
  "DOCUMENT",
  "LISTING_CONSISTENCY",
]

export function VerificationQueue() {
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    priority: "",
    assignedToMe: "",
  })
  const list = usePagedList<VerificationQueueItem>(
    "/admin/trust/verifications",
    { ...filters, limit: 25 },
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setFilters({
      status: String(form.get("status") ?? ""),
      type: String(form.get("type") ?? ""),
      priority: String(form.get("priority") ?? ""),
      assignedToMe: form.get("assignedToMe") ? "true" : "",
    })
  }

  return (
    <>
      <PageHeader
        title="Vérifications"
        description="Plus anciens d'abord. Les pièces ne sont accessibles que par lien court, à la demande et avec l'habilitation dédiée."
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
            <option value="">À traiter</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="type"
            defaultValue={filters.type}
            className={inputClass}
          >
            <option value="">Tous</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priorité
          <select
            name="priority"
            defaultValue={filters.priority}
            className={inputClass}
          >
            <option value="">Toutes</option>
            {["HIGH", "NORMAL", "LOW"].map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="assignedToMe"
            defaultChecked={filters.assignedToMe === "true"}
          />
          Mes dossiers
        </label>
        <Button type="submit">Filtrer</Button>
      </form>
      {list.status === "loading" ? <Loading /> : null}
      {list.status === "error" && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" ? (
        list.items.length === 0 ? (
          <EmptyState>Aucun dossier pour ces critères.</EmptyState>
        ) : (
          <>
            <Table
              headers={[
                "Type",
                "Statut",
                "Priorité",
                "Pièces",
                "Soumis depuis",
              ]}
            >
              {list.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/verifications/${item.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {item.type}
                    </Link>
                    {item.assignedTo ? (
                      <p className="text-xs text-stone-500">Affecté</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={item.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={item.priority} label={item.priority} />
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {item.documents}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatAge(item.submittedAt ?? item.createdAt)}
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
