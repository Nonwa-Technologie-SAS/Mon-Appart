"use client"

import { ArrowRight, LayoutList } from "lucide-react"
import Link from "next/link"

import { formatAge, formatDateTime, formatNumber } from "@/lib/format"
import { QUEUE_ICONS } from "@/lib/nav-icons"
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
        <div className="flex flex-col gap-8">
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
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="queues-title" className="text-lg font-semibold text-foreground">
          Files d&apos;attente
        </h2>
        <p className="text-xs text-muted-foreground">
          Calculé le {formatDateTime(dashboard.computedAt)}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.queues.map((queue) => {
          const Icon = QUEUE_ICONS[queue.key] ?? LayoutList
          return (
            <li
              key={queue.key}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-primary transition-colors group-hover:bg-secondary"
              />
              <div className="flex items-start justify-between gap-3 pl-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {queue.label}
                </p>
                <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                  <Icon aria-hidden className="size-4" />
                </span>
              </div>
              <p className="mt-2 pl-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {formatNumber(queue.value)}
              </p>
              <p className="mt-3 pl-2 text-xs leading-relaxed text-muted-foreground">
                {queue.definition}
              </p>
              {queue.oldestAt ? (
                <p className="mt-1 pl-2 text-xs text-muted-foreground">
                  Plus ancien : {formatAge(queue.oldestAt)}
                </p>
              ) : null}
              <Link
                href={queue.link}
                className="mt-4 inline-flex items-center gap-1.5 pl-2 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Ouvrir la file
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </li>
          )
        })}
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
            <dl className="grid gap-4 sm:grid-cols-3">
              {KPI_LABELS.map((kpi) => {
                const value = overview.data.kpis[kpi.key]
                return (
                  <div
                    key={kpi.key}
                    className="rounded-lg bg-muted/50 px-3 py-3"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">
                      {kpi.label}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
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
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
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
