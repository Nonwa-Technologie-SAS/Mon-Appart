"use client"

import { useState, type FormEvent } from "react"

import type { AuditEntry } from "@/lib/types"
import { usePagedList } from "@/lib/use-api"

import { AuditTable } from "./audit-table"
import {
  Button,
  ErrorState,
  LoadMore,
  Loading,
  PageHeader,
  inputClass,
} from "./ui"

interface Filters {
  entityType: string
  entityId: string
  action: string
  actorId: string
  from: string
  to: string
}

const EMPTY: Filters = {
  entityType: "",
  entityId: "",
  action: "",
  actorId: "",
  from: "",
  to: "",
}

/** L'API traite `to` comme borne exclue : on envoie le lendemain du jour saisi. */
export function nextDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function AuditLogView({ initial }: { initial: Partial<Filters> }) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initial })
  const list = usePagedList<AuditEntry>("/admin/audit-logs", {
    ...filters,
    to: nextDay(filters.to),
    limit: 50,
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const read = (key: keyof Filters) => String(form.get(key) ?? "").trim()
    setFilters({
      entityType: read("entityType"),
      entityId: read("entityId"),
      action: read("action").toUpperCase(),
      actorId: read("actorId"),
      from: read("from"),
      to: read("to"),
    })
  }

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        description="Du plus récent au plus ancien. Les secrets, jetons et codes sont masqués. Ce journal est distinct des statistiques analytiques."
      />
      <form
        onSubmit={onSubmit}
        className="mb-4 flex flex-wrap items-end gap-3"
        role="search"
      >
        {(
          [
            ["entityType", "Type d'entité (ex. user, listing)"],
            ["entityId", "Identifiant d'entité"],
            ["action", "Action (ex. USER_SUSPENDED)"],
            ["actorId", "Identifiant de l'acteur"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            {label}
            <input
              name={key}
              defaultValue={filters[key]}
              maxLength={100}
              className={inputClass}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          Depuis
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Jusqu&apos;au (inclus)
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
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
        <>
          <AuditTable entries={list.items} />
          <LoadMore
            hasMore={Boolean(list.nextCursor)}
            loading={list.loadingMore}
            error={list.error}
            onClick={() => void list.loadMore()}
          />
        </>
      ) : null}
    </>
  )
}
