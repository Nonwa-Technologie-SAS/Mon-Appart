"use client"

import { formatDateTime, formatMoney, statusLabel } from "@/lib/format"
import type { BillingSummary } from "@/lib/types"
import { useResource } from "@/lib/use-api"

import { EmptyState, ErrorState, Loading, Section } from "../ui"

/**
 * Montants bruts confirmés par le prestataire. Aucun revenu net n'est
 * calculé : les frais réels du prestataire ne sont pas connus ici.
 */
export function BillingSummaryPanel() {
  const summary = useResource<BillingSummary>("/admin/billing/summary")
  if (summary.status === "loading") return <Loading />
  if (summary.status === "error") {
    return <ErrorState error={summary.error} onRetry={summary.reload} />
  }
  const data = summary.data
  return (
    <div className="flex flex-col gap-4">
      <ProviderNotice provider={data.provider} />
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Encaissé (brut)">
          {data.collected.length === 0 ? (
            <EmptyState>Aucun paiement confirmé.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.collected.map((row) => (
                <li key={`${row.currency}-${row.environment}`}>
                  <span className="font-medium tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </span>{" "}
                  · {row.payments} paiement(s) ·{" "}
                  {row.environment === "TEST"
                    ? "test (aucun encaissement réel)"
                    : "réel"}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {data.definitions.collected}
          </p>
        </Section>
        <Section title="Remboursé">
          {data.refunded.length === 0 ? (
            <EmptyState>Aucun remboursement confirmé.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.refunded.map((row) => (
                <li key={row.currency}>
                  <span className="font-medium tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </span>{" "}
                  · {row.refunds} remboursement(s)
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {data.definitions.refunded}
          </p>
        </Section>
        <Section title="Commandes par statut">
          <Counts values={data.ordersByStatus} />
        </Section>
        <Section title="Abonnements par statut">
          <Counts values={data.subscriptionsByStatus} />
        </Section>
        <Section title="À traiter">
          <p className="text-sm">
            Incidents ouverts : <strong>{data.openIncidents}</strong>
          </p>
          <p className="text-sm">
            Remboursements en attente : <strong>{data.pendingRefunds}</strong>
          </p>
        </Section>
      </div>
      <p className="text-xs text-muted-foreground">
        Calculé le {formatDateTime(data.computedAt)}.
      </p>
    </div>
  )
}

function ProviderNotice({
  provider,
}: {
  provider: BillingSummary["provider"]
}) {
  if (!provider) {
    return (
      <p
        role="status"
        className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      >
        Aucun prestataire de paiement configuré : les achats sont désactivés.
      </p>
    )
  }
  if (provider.simulated) {
    return (
      <p
        role="status"
        className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      >
        Prestataire simulé (« {provider.code} », environnement{" "}
        {provider.environment}) : aucun argent n’est encaissé. Ne jamais
        l’utiliser en production.
      </p>
    )
  }
  return (
    <p className="text-sm text-foreground">
      Prestataire : {provider.code} · environnement {provider.environment}
    </p>
  )
}

function Counts({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values)
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune donnée.</p>
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {entries.map(([status, count]) => (
        <li key={status}>
          {statusLabel(status)} :{" "}
          <strong className="tabular-nums">{count}</strong>
        </li>
      ))}
    </ul>
  )
}
