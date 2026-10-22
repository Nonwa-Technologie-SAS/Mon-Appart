"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { nestApiBaseUrl, nestApiUrl } from "@/lib/nest-url"

type ListingStatsPage = {
  items: Array<{
    listing: { id: string; title: string; status: string }
    totals: {
      detailViews: number
      contactsSubmitted: number
      appointmentsRequested: number
      qualifiedLeads: number
    }
    rates: {
      contactRate: number | null
      appointmentRate: number | null
    }
  }>
  meta: { computedAt: string | null; completedDay: string | null }
}

/**
 * Stats propriétaire/agence via Nest Analytics.
 * Nécessite NEXT_PUBLIC_NEST_API_URL + jeton (non géré ici : message si absents).
 */
export function PublisherAnalytics() {
  const configured = nestApiBaseUrl() !== null
  const [page, setPage] = useState<ListingStatsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!configured) return
    startTransition(async () => {
      try {
        const res = await fetch(nestApiUrl("/api/v1/analytics/me/listings"), {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
        if (res.status === 401) {
          setError(
            "Connectez-vous pour voir les statistiques de vos annonces.",
          )
          return
        }
        if (!res.ok) {
          setError(`Impossible de charger les stats (HTTP ${res.status}).`)
          return
        }
        setPage((await res.json()) as ListingStatsPage)
        setError(null)
      } catch {
        setError("Service analytique indisponible.")
      }
    })
  }, [configured])

  if (!configured) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="font-semibold">Performances de mes annonces</h2>
        <p className="mt-2 text-muted-foreground">
          Configurez <code className="text-xs">NEST_API_URL</code> /{" "}
          <code className="text-xs">NEXT_PUBLIC_NEST_API_URL</code> pour
          afficher les statistiques agrégées (vues, contacts, visites)
          provenant de l’API Nest — jamais inventées.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-busy={pending}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Performances de mes annonces</h2>
          <p className="text-xs text-muted-foreground">
            Compteurs agrégés uniquement. Aucune identité de visiteur.
            {page?.meta.completedDay
              ? ` Données jusqu’au ${page.meta.completedDay}.`
              : null}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/pour-vous" />}
        >
          Voir les suggestions
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {pending && !page ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : null}

      {page && page.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune annonce gérée avec statistiques sur la période.
        </p>
      ) : null}

      {page && page.items.length > 0 ? (
        <ul className="divide-y divide-border">
          {page.items.map((item) => (
            <li
              key={item.listing.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{item.listing.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.listing.status}
                </p>
              </div>
              <dl className="flex flex-wrap gap-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Vues</dt>
                  <dd className="font-semibold tabular-nums">
                    {item.totals.detailViews}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contacts</dt>
                  <dd className="font-semibold tabular-nums">
                    {item.totals.contactsSubmitted}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Visites</dt>
                  <dd className="font-semibold tabular-nums">
                    {item.totals.appointmentsRequested}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Taux contact</dt>
                  <dd className="font-semibold tabular-nums">
                    {item.rates.contactRate == null
                      ? "—"
                      : `${Math.round(item.rates.contactRate * 1000) / 10} %`}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
