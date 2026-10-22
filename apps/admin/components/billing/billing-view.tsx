"use client"

import { useState } from "react"

import { BILLING_TABS, type BillingTab } from "@/lib/billing"
import { formatDateTime, statusLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { BillingWebhookEvent } from "@/lib/types"
import { useResource } from "@/lib/use-api"

import { useSession } from "../session-provider"
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Table,
  inputClass,
} from "../ui"
import { BillingCatalog } from "./billing-catalog"
import {
  IncidentList,
  OrderList,
  PaymentList,
  RefundList,
  SubscriptionList,
} from "./billing-lists"
import { BillingSummaryPanel } from "./billing-summary"

export function BillingView({ initialTab }: { initialTab: BillingTab }) {
  const {
    state: { me },
  } = useSession()
  const [tab, setTab] = useState<BillingTab>(initialTab)

  if (!can(me, "billing:read")) {
    return (
      <EmptyState>
        Accès réservé aux comptes habilités à la facturation.
      </EmptyState>
    )
  }

  return (
    <>
      <PageHeader
        title="Facturation"
        description="Services de la plateforme uniquement (abonnements). Aucun loyer, dépôt ni prix de vente n'est encaissé ici. Un paiement n'est réussi qu'après confirmation du prestataire."
      />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {BILLING_TABS.map((item) => (
          <Button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            variant={tab === item.key ? "primary" : "secondary"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {tab === "summary" ? <BillingSummaryPanel /> : null}
      {tab === "orders" ? <OrderList /> : null}
      {tab === "payments" ? <PaymentList /> : null}
      {tab === "subscriptions" ? <SubscriptionList /> : null}
      {tab === "refunds" ? <RefundList /> : null}
      {tab === "incidents" ? <IncidentList /> : null}
      {tab === "webhooks" ? <WebhookEventList /> : null}
      {tab === "catalog" ? <BillingCatalog /> : null}
    </>
  )
}

const OUTCOMES = ["RECEIVED", "APPLIED", "IGNORED", "REJECTED"]

/** Trace minimale des notifications : ni corps brut, ni signature, ni secret. */
function WebhookEventList() {
  const [outcome, setOutcome] = useState("")
  const [before, setBefore] = useState<string | null>(null)
  const events = useResource<{
    items: BillingWebhookEvent[]
    nextBefore: string | null
  }>("/admin/billing/webhook-events", { outcome, before, limit: 50 })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Résultat
          <select
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value)
              setBefore(null)
            }}
            className={inputClass}
          >
            <option value="">Tous</option>
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {before ? (
          <Button variant="secondary" onClick={() => setBefore(null)}>
            Revenir aux plus récentes
          </Button>
        ) : null}
      </div>
      {events.status === "loading" ? (
        <Loading />
      ) : events.status === "error" ? (
        <ErrorState error={events.error} onRetry={events.reload} />
      ) : events.data.items.length === 0 ? (
        <EmptyState>Aucune notification pour ce filtre.</EmptyState>
      ) : (
        <>
          <Table
            headers={[
              "Reçue",
              "Prestataire",
              "Événement",
              "Signature",
              "Résultat",
              "Réceptions",
              "Paiement",
            ]}
          >
            {events.data.items.map((event) => (
              <tr key={`${event.provider}-${event.eventId}`}>
                <td className="px-3 py-2 text-xs">
                  {formatDateTime(event.receivedAt)}
                </td>
                <td className="px-3 py-2 text-xs">{event.provider}</td>
                <td className="px-3 py-2 font-mono text-xs">{event.eventId}</td>
                <td className="px-3 py-2 text-xs">
                  {event.signatureValid ? "Valide" : "Invalide"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {statusLabel(event.outcome)}
                  {event.errorCode ? ` · ${event.errorCode}` : ""}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {event.attempts}
                </td>
                <td className="px-3 py-2 text-xs">
                  {event.paymentId ? "Rattachée" : "—"}
                </td>
              </tr>
            ))}
          </Table>
          {events.data.nextBefore ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => setBefore(events.data.nextBefore)}
              >
                Plus anciennes
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
