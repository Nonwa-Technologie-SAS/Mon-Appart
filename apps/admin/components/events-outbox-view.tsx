"use client"

import { type FormEvent, useState } from "react"

import { formatDateTime } from "@/lib/format"
import { useMutation, usePagedList, useResource } from "@/lib/use-api"

import {
  ActionError,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  LoadMore,
  PageHeader,
  inputClass,
} from "./ui"

type OutboxRow = {
  id: string
  eventId: string
  eventType: string
  producer: string
  aggregateType: string
  aggregateId: string
  occurredAt: string
  status: string
  attemptCount: number
  lastError: string | null
}

type OutboxStats = {
  byStatus: Record<string, number>
  oldestPendingAt: string | null
  oldestPendingType: string | null
}

export function EventsOutboxView() {
  const [status, setStatus] = useState("DEAD")
  const [eventType, setEventType] = useState("")
  const stats = useResource<OutboxStats>("/admin/events/outbox/stats")
  const list = usePagedList<OutboxRow>("/admin/events/outbox", {
    status,
    eventType,
    limit: 50,
  })
  const replay = useMutation()

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus(String(form.get("status") ?? ""))
    setEventType(String(form.get("eventType") ?? "").trim())
  }

  async function onReplay(eventId: string) {
    const result = await replay.run(
      `/admin/events/outbox/${eventId}/replay`,
      {},
    )
    if (result.ok) {
      list.reload()
      stats.reload()
    }
  }

  return (
    <>
      <PageHeader
        title="Événements de domaine"
        description="File Outbox : échecs persistants et rejeu contrôlé. Les charges utiles ne sont pas affichées."
      />
      {stats.status === "ready" ? (
        <p className="mb-4 text-sm text-stone-600">
          En attente : {stats.data.byStatus.PENDING ?? 0} · File morte :{" "}
          {stats.data.byStatus.DEAD ?? 0} · Publiés :{" "}
          {stats.data.byStatus.PUBLISHED ?? 0}
          {stats.data.oldestPendingType
            ? ` · Plus ancien en attente : ${stats.data.oldestPendingType}`
            : ""}
        </p>
      ) : null}
      <form
        onSubmit={onFilter}
        className="mb-4 flex flex-wrap items-end gap-3"
        role="search"
      >
        <label className="text-sm">
          Statut
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="">Tous</option>
            <option value="DEAD">File morte</option>
            <option value="PENDING">En attente</option>
            <option value="PUBLISHING">Publication</option>
            <option value="PUBLISHED">Publiés</option>
            <option value="FAILED">Échec</option>
          </select>
        </label>
        <label className="text-sm">
          Type
          <input
            name="eventType"
            defaultValue={eventType}
            placeholder="listing.published"
            className={inputClass}
          />
        </label>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>
      <ActionError error={replay.error} />
      {list.status === "loading" ? (
        <Loading />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState>Aucun événement pour ces filtres.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Agrégat</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Tentatives</th>
                <th className="px-3 py-2">Survenu</th>
                <th className="px-3 py-2">Erreur</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.eventId} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.eventType}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.aggregateType}/{row.aggregateId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge value={row.status} />
                  </td>
                  <td className="px-3 py-2">{row.attemptCount}</td>
                  <td className="px-3 py-2">
                    {formatDateTime(row.occurredAt)}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-stone-600">
                    {row.lastError ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "DEAD" || row.status === "FAILED" ? (
                      <Button
                        variant="secondary"
                        disabled={replay.pending}
                        onClick={() => void onReplay(row.eventId)}
                      >
                        Rejouer
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <LoadMore
            hasMore={Boolean(list.nextCursor)}
            loading={list.loadingMore}
            error={list.error}
            onClick={() => void list.loadMore()}
          />
        </div>
      )}
    </>
  )
}
