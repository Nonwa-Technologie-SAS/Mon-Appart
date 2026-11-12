"use client"

import { useMemo, useState } from "react"

import { formatDateTime, formatNumber } from "@/lib/format"
import { useResource } from "@/lib/use-api"

import { EmptyState, ErrorState, Loading, PageHeader, Section } from "../ui"

type Tab =
  | "direction"
  | "funnel"
  | "search"
  | "market"
  | "recommendations"
  | "quality"
  | "catalog"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "direction", label: "Direction" },
  { id: "funnel", label: "Entonnoir" },
  { id: "search", label: "Recherche" },
  { id: "market", label: "Marché" },
  { id: "recommendations", label: "Reco" },
  { id: "quality", label: "Qualité" },
  { id: "catalog", label: "Catalogue" },
]

function pct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${Math.round(value * 1000) / 10} %`
}

function KpiGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border bg-white p-3"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function DirectionPanel() {
  const data = useResource<{
    range: { from: string; to: string }
    platform: Record<string, number | null>
    demand: {
      searchesSubmitted: number
      zeroResults: number
      zeroResultRate: number | null
    }
    supply: {
      activeListings: number
      distinctProperties: number
      byListingType: Array<{ value: string; count: number }>
    }
    meta: {
      computedAt: string | null
      marketComputedAt: string
      billingNote: string
      disclaimer: string
    }
  }>("/admin/analytics/direction")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  const d = data.data
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid
        items={[
          {
            label: "Inscriptions (période)",
            value: formatNumber(d.platform.registrations ?? 0),
          },
          {
            label: "Annonces publiées (flux)",
            value: formatNumber(d.platform.listings_published ?? 0),
          },
          {
            label: "Contacts",
            value: formatNumber(d.platform.contacts ?? 0),
          },
          {
            label: "Visites demandées",
            value: formatNumber(d.platform.appointments_requested ?? 0),
          },
          {
            label: "Contacts → visite",
            value: pct(d.platform.contactToAppointmentRate),
          },
          {
            label: "Recherches soumises",
            value: formatNumber(d.demand.searchesSubmitted),
          },
          {
            label: "Taux zéro résultat",
            value: pct(d.demand.zeroResultRate),
          },
          {
            label: "Annonces actives (stock)",
            value: formatNumber(d.supply.activeListings),
          },
          {
            label: "Biens distincts (stock)",
            value: formatNumber(d.supply.distinctProperties),
          },
        ]}
      />
      <Section title="Offre par type d’opération">
        {d.supply.byListingType.length === 0 ? (
          <EmptyState>Aucune annonce active.</EmptyState>
        ) : (
          <ul className="text-sm">
            {d.supply.byListingType.map((row) => (
              <li
                key={row.value}
                className="flex justify-between border-b py-1"
              >
                <span>{row.value}</span>
                <span className="tabular-nums">{formatNumber(row.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="text-xs text-muted-foreground">
        Période agrégats {d.range.from} → {d.range.to}. Dernier calcul agrégats
        : {d.meta.computedAt ? formatDateTime(d.meta.computedAt) : "—"}.
        Snapshot marché : {formatDateTime(d.meta.marketComputedAt)}.{" "}
        {d.meta.billingNote}
      </p>
      <p className="text-xs text-amber-800">{d.meta.disclaimer}</p>
    </div>
  )
}

function FunnelPanel() {
  const data = useResource<{
    steps: Array<{
      step: string
      actorDays: number
      fromPrevious: number | null
      fromStart: number | null
    }>
    unit: string
    meta: { computedAt: string | null }
  }>("/admin/analytics/funnel")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Unité : {data.data.unit} · cohorte consentement navigation. Un taux « —
        » signifie dénominateur nul (souvent tracker client non branché).
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2">Étape</th>
            <th>Acteur-jours</th>
            <th>Depuis précédente</th>
            <th>Depuis le début</th>
          </tr>
        </thead>
        <tbody>
          {data.data.steps.map((step) => (
            <tr key={step.step} className="border-b">
              <td className="py-2 font-medium">{step.step}</td>
              <td className="tabular-nums">{formatNumber(step.actorDays)}</td>
              <td>{pct(step.fromPrevious)}</td>
              <td>{pct(step.fromStart)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SearchPanel() {
  const data = useResource<{
    submitted: number
    zeroResults: number
    zeroResultRate: number | null
    byCommune: Array<{ value: string; count: number }>
    byListingType: Array<{ value: string; count: number }>
    byBudget: Array<{ value: string; count: number }>
  }>("/admin/analytics/search")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  const d = data.data
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid
        items={[
          { label: "Recherches", value: formatNumber(d.submitted) },
          { label: "Sans résultat", value: formatNumber(d.zeroResults) },
          { label: "Taux zéro", value: pct(d.zeroResultRate) },
        ]}
      />
      <Section title="Par commune (groupes trop petits → OTHER)">
        <BarList rows={d.byCommune} />
      </Section>
      <Section title="Par type d’offre">
        <BarList rows={d.byListingType} />
      </Section>
      <Section title="Par budget déclaré">
        <BarList rows={d.byBudget} />
      </Section>
    </div>
  )
}

function BarList({ rows }: { rows: Array<{ value: string; count: number }> }) {
  if (rows.length === 0) return <EmptyState>Aucune donnée.</EmptyState>
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="space-y-2">
      {rows.slice(0, 15).map((row) => (
        <li key={row.value}>
          <div className="mb-0.5 flex justify-between text-xs">
            <span>{row.value}</span>
            <span className="tabular-nums">{formatNumber(row.count)}</span>
          </div>
          <div className="h-2 rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function MarketPanel() {
  const data = useResource<{
    stock: {
      activeListings: number
      distinctProperties: number
      byListingType: Array<{ value: string; count: number }>
      byCommune: Array<{ value: string; count: number }>
    }
    prices: {
      currency: string
      buckets: Array<{
        commune: string
        listingType: string
        propertyType: string
        period: string
        listings: number
        median: number | null
        p25: number | null
        p75: number | null
      }>
      suppressedGroups: number
    }
    disclaimer: string
    meta: { computedAt: string; minGroupSize: number }
  }>("/admin/analytics/market")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  const d = data.data
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid
        items={[
          {
            label: "Annonces actives",
            value: formatNumber(d.stock.activeListings),
          },
          {
            label: "Biens distincts",
            value: formatNumber(d.stock.distinctProperties),
          },
          {
            label: "Groupes prix masqués",
            value: formatNumber(d.prices.suppressedGroups),
          },
        ]}
      />
      <Section title={`Prix observés (${d.prices.currency})`}>
        {d.prices.buckets.length === 0 ? (
          <EmptyState>Aucun bucket de prix publiable.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2">Commune</th>
                  <th>Offre</th>
                  <th>Type</th>
                  <th>Période</th>
                  <th>N</th>
                  <th>Médiane</th>
                  <th>P25</th>
                  <th>P75</th>
                </tr>
              </thead>
              <tbody>
                {d.prices.buckets.slice(0, 40).map((b, i) => (
                  <tr
                    key={`${b.commune}-${b.listingType}-${b.propertyType}-${b.period}-${i}`}
                    className="border-b"
                  >
                    <td className="py-1">{b.commune}</td>
                    <td>{b.listingType}</td>
                    <td>{b.propertyType}</td>
                    <td>{b.period}</td>
                    <td className="tabular-nums">{b.listings}</td>
                    <td className="tabular-nums">
                      {b.median == null
                        ? "—"
                        : formatNumber(Math.round(b.median))}
                    </td>
                    <td className="tabular-nums">
                      {b.p25 == null ? "—" : formatNumber(Math.round(b.p25))}
                    </td>
                    <td className="tabular-nums">
                      {b.p75 == null ? "—" : formatNumber(Math.round(b.p75))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="text-xs text-amber-800">{d.disclaimer}</p>
      <p className="text-xs text-muted-foreground">
        Snapshot {formatDateTime(d.meta.computedAt)} · seuil groupe ≥{" "}
        {d.meta.minGroupSize}
      </p>
    </div>
  )
}

function RecoPanel() {
  const data = useResource<{
    byAlgorithm: Array<{
      algorithmVersion: string
      requests: number
      impressions: number
      opens: number
      conversions: number
      clickThroughRate: number | null
      conversionRate: number | null
    }>
  }>("/admin/analytics/recommendations")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  if (data.data.byAlgorithm.length === 0) {
    return (
      <EmptyState>
        Aucune donnée de recommandation sur la période (exposition client
        souvent absente).
      </EmptyState>
    )
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th className="py-2">Algorithme</th>
          <th>Requêtes</th>
          <th>Impressions</th>
          <th>Ouvertures</th>
          <th>CTR</th>
          <th>Conv.</th>
        </tr>
      </thead>
      <tbody>
        {data.data.byAlgorithm.map((row) => (
          <tr key={row.algorithmVersion} className="border-b">
            <td className="py-2 font-medium">{row.algorithmVersion}</td>
            <td className="tabular-nums">{formatNumber(row.requests)}</td>
            <td className="tabular-nums">{formatNumber(row.impressions)}</td>
            <td className="tabular-nums">{formatNumber(row.opens)}</td>
            <td>{pct(row.clickThroughRate)}</td>
            <td>{pct(row.conversionRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function QualityPanel() {
  const data = useResource<{
    rejectionRate: number | null
    aggregation: {
      completedDay: string | null
      lastSuccessAt: string | null
      lastError: string | null
      durationMs: number | null
    }
    ingestion: Array<{
      source: string
      outcome: string
      reason: string | null
      count: number
    }>
  }>("/admin/analytics/quality")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  const d = data.data
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid
        items={[
          { label: "Taux rejet ingestion", value: pct(d.rejectionRate) },
          {
            label: "Jour agrégé",
            value: d.aggregation.completedDay ?? "—",
          },
          {
            label: "Durée dernier run",
            value:
              d.aggregation.durationMs == null
                ? "—"
                : `${d.aggregation.durationMs} ms`,
          },
        ]}
      />
      {d.aggregation.lastError ? (
        <p role="alert" className="text-sm text-red-800">
          Dernière erreur d’agrégation : {d.aggregation.lastError}
        </p>
      ) : null}
      <Section title="Ingestion">
        <ul className="text-sm">
          {d.ingestion.slice(0, 20).map((row, i) => (
            <li
              key={`${row.source}-${row.outcome}-${row.reason}-${i}`}
              className="flex justify-between border-b py-1"
            >
              <span>
                {row.source} · {row.outcome}
                {row.reason ? ` · ${row.reason}` : ""}
              </span>
              <span className="tabular-nums">{formatNumber(row.count)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function CatalogPanel() {
  const data = useResource<{
    metrics: Array<{
      id: string
      name: string
      description: string
      formula: string
      freshness: string
      limitations: string
      roles: string[]
    }>
  }>("/admin/analytics/metrics")

  if (data.status === "loading") return <Loading />
  if (data.status === "error")
    return <ErrorState error={data.error} onRetry={data.reload} />
  return (
    <ul className="space-y-3">
      {data.data.metrics.map((metric) => (
        <li
          key={metric.id}
          className="rounded-lg border border-border bg-white p-3 text-sm"
        >
          <p className="font-medium">
            {metric.name}{" "}
            <code className="text-xs text-muted-foreground">{metric.id}</code>
          </p>
          <p className="mt-1 text-muted-foreground">{metric.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Formule : {metric.formula} · Fraîcheur : {metric.freshness} · Rôles
            : {metric.roles.join(", ")}
          </p>
          <p className="mt-1 text-xs text-amber-800">{metric.limitations}</p>
        </li>
      ))}
    </ul>
  )
}

export function BiDashboardView() {
  const [tab, setTab] = useState<Tab>("direction")
  const panel = useMemo(() => {
    switch (tab) {
      case "direction":
        return <DirectionPanel />
      case "funnel":
        return <FunnelPanel />
      case "search":
        return <SearchPanel />
      case "market":
        return <MarketPanel />
      case "recommendations":
        return <RecoPanel />
      case "quality":
        return <QualityPanel />
      case "catalog":
        return <CatalogPanel />
    }
  }, [tab])

  return (
    <>
      <PageHeader
        title="Business Intelligence"
        description="Indicateurs calculés côté API Analytics. Filtres de période = 30 derniers jours par défaut. Aucun chiffre fictif."
      />
      <div
        className="mb-4 flex flex-wrap gap-1"
        role="tablist"
        aria-label="Vues BI"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors aria-[selected=true]:border-primary aria-[selected=true]:bg-primary aria-[selected=true]:text-primary-foreground"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {panel}
    </>
  )
}
