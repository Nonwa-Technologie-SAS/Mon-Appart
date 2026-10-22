"use client"

import { formatDateTime } from "@/lib/format"
import type { AuditEntry } from "@/lib/types"

import { EmptyState, Table } from "./ui"

function summarize(values: unknown): string {
  if (values === null || values === undefined) return "—"
  const text = JSON.stringify(values)
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}

/** Valeurs déjà expurgées par l'API (secrets, jetons, codes). */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState>Aucune entrée d&apos;audit.</EmptyState>
  }
  return (
    <Table headers={["Date", "Action", "Acteur", "Cible", "Avant", "Après"]}>
      {entries.map((entry, index) => (
        <tr key={`${entry.at}-${entry.action}-${index}`} className="align-top">
          <td className="whitespace-nowrap px-3 py-2 text-xs">
            {formatDateTime(entry.at)}
          </td>
          <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
          <td className="px-3 py-2 text-xs">
            {entry.actor ? (entry.actor.name ?? entry.actor.id) : "Système"}
          </td>
          <td className="px-3 py-2 font-mono text-xs">
            {entry.entityType}
            <br />
            <span className="text-stone-500">{entry.entityId}</span>
          </td>
          <td className="max-w-xs break-all px-3 py-2 font-mono text-xs text-stone-600">
            {summarize(entry.oldValues)}
          </td>
          <td className="max-w-xs break-all px-3 py-2 font-mono text-xs text-stone-600">
            {summarize(entry.newValues)}
          </td>
        </tr>
      ))}
    </Table>
  )
}
