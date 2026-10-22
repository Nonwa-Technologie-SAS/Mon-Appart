"use client"

import Link from "next/link"

import { formatAge, formatDateTime, formatNumber } from "@/lib/format"
import type { AnalyticsOverview, Dashboard } from "@/lib/types"
import { useResource } from "@/lib/use-api"

import { EmptyState, ErrorState, Loading, PageHeader, Section } from "./ui"

const KPI_LABELS: Array<{ key: string; label: string; rate?: boolean }> = [
  { key: "registrations", label: "Inscriptions" },
  { key: "listings_published", label: "Annonces publiées" },
  { key: "contacts", label: "Prises de contact" },
  { key: "appointments_requested", label: "Visites demandées" },
  { key: "appointments_completed", label: "Visites réalisées" },
  {
    key: "contactToAppointmentRate",
    label: "Contacts → visite demandée",
    rate: true,
  },
]

export function DashboardView() {
  const dashboard = useResource<Dashboard>("/admin/dashboard")

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Files d'attente calculées en direct à partir des données de la plateforme, limitées à vos permissions."
      />
      {dashboard.status === "loading" ? <Loading /> : null}
      {dashboard.status === "error" ? (
        <ErrorState error={dashboard.error} onRetry={dashboard.reload} />
      ) : null}
      {dashboard.status === "ready" ? (
        <div className="flex flex-col gap-6">
          <Queues dashboard={dashboard.data} />
          {dashboard.data.analyticsAvailable ? <AnalyticsPanel /> : null}
        </div>
      ) : null}
    </>
  )
}

function Queues({ dashboard }: { dashboard: Dashboard }) {
  if (dashboard.queues.length === 0) {
    return (
      <EmptyState>
        Aucune file d&apos;attente n&apos;est associée à vos permissions.
      </EmptyState>
    )
  }
  return (
    <section aria-labelledby="queues-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="queues-title" className="text-lg font-semibold">
          Files d&apos;attente
        </h2>
        <p className="text-xs text-stone-500">
          Calculé le {formatDateTime(dashboard.computedAt)}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.queues.map((queue) => (
          <li
            key={queue.key}
            className="flex flex-col rounded-lg border border-stone-200 bg-white p-4"
          >
            <p className="text-sm font-medium text-stone-700">{queue.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {formatNumber(queue.value)}
            </p>
            <p className="mt-2 text-xs text-stone-500">{queue.definition}</p>
            {queue.oldestAt ? (
              <p className="mt-1 text-xs text-stone-500">
                Plus ancien : {formatAge(queue.oldestAt)}
              </p>
            ) : null}
            <Link
              href={queue.link}
              className="mt-3 text-sm font-medium text-stone-900 underline underline-offset-2"
            >
              Ouvrir la file
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AnalyticsPanel() {
  const overview = useResource<AnalyticsOverview>("/admin/analytics/overview")

  return (
    <Section title="Activité des 30 derniers jours (analytique)">
      {overview.status === "loading" ? <Loading /> : null}
      {overview.status === "error" ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : null}
      {overview.status === "ready" ? (
        overview.data.meta.computedAt ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              {KPI_LABELS.map((kpi) => {
                const value = overview.data.kpis[kpi.key]
                return (
                  <div key={kpi.key}>
                    <dt className="text-xs text-stone-500">{kpi.label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {value === null || value === undefined
                        ? "—"
                        : kpi.rate
                          ? `${Math.round(value * 1000) / 10} %`
                          : formatNumber(value)}
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="mt-3 text-xs text-stone-500">
              Période du {overview.data.range.from} au {overview.data.range.to}.
              Données agrégées jusqu&apos;au{" "}
              {overview.data.meta.completedDay ?? "—"} (dernier calcul :{" "}
              {formatDateTime(overview.data.meta.computedAt)}). Un taux sans
              dénominateur s&apos;affiche « — ».
            </p>
          </>
        ) : (
          <EmptyState>
            Aucune agrégation analytique n&apos;a encore été calculée : aucun
            indicateur n&apos;est affiché.
          </EmptyState>
        )
      ) : null}
    </Section>
  )
}
