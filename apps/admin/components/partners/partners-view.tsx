"use client"

import { useState } from "react"

import { formatDateTime } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useResource } from "@/lib/use-api"

import { useSession } from "../session-provider"
import { EmptyState, ErrorState, Loading, PageHeader, Table } from "../ui"

type PartnerRow = {
  id: string
  code: string
  name: string
  category: string
  commercialStatus: string
  createdAt: string
  integrations: Array<{
    id: string
    kind: string
    status: string
    hasWebhookSecret: boolean
    lastError: string | null
  }>
}

const cell = "px-3 py-2 align-top"

/**
 * Registre partenaires — lecture seule côté UI V1.
 * Création / webhooks via API admin (pas de faux partenaires affichés).
 */
export function PartnersView() {
  const {
    state: { me },
  } = useSession()
  const [cursor, setCursor] = useState<string | undefined>()
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
  const resource = useResource<{
    items: PartnerRow[]
    nextCursor: string | null
  }>(`/admin/partners${query}`)

  if (!can(me, "partner:read") && !can(me, "partner:manage")) {
    return (
      <EmptyState>
        Accès réservé aux comptes habilités aux partenariats.
      </EmptyState>
    )
  }

  return (
    <>
      <PageHeader
        title="Partenaires"
        description="Registre technique et commercial. Un statut commercial ACTIVE n’implique pas une intégration opérationnelle. Aucun partenaire n’est inventé ici."
      />
      {resource.status === "loading" ? <Loading /> : null}
      {resource.status === "error" ? (
        <ErrorState error={resource.error} onRetry={resource.reload} />
      ) : null}
      {resource.status === "ready" && resource.data.items.length === 0 ? (
        <EmptyState>
          Aucun partenaire enregistré. Utilisez l’API admin pour créer un
          enregistrement réel après accord commercial.
        </EmptyState>
      ) : null}
      {resource.status === "ready" && resource.data.items.length > 0 ? (
        <Table
          headers={[
            "Nom",
            "Code",
            "Catégorie",
            "Commercial",
            "Intégrations",
            "Créé",
          ]}
        >
          {resource.data.items.map((partner) => (
            <tr key={partner.id}>
              <td className={cell}>{partner.name}</td>
              <td className={`${cell} font-mono text-xs`}>{partner.code}</td>
              <td className={cell}>{partner.category}</td>
              <td className={cell}>{partner.commercialStatus}</td>
              <td className={`${cell} text-xs`}>
                {partner.integrations.length === 0
                  ? "—"
                  : partner.integrations
                      .map((item) => `${item.kind}:${item.status}`)
                      .join(", ")}
              </td>
              <td className={`${cell} text-xs`}>
                {formatDateTime(partner.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}
      {resource.status === "ready" && resource.data.nextCursor ? (
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => setCursor(resource.data.nextCursor!)}
        >
          Page suivante
        </button>
      ) : null}
    </>
  )
}
