"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2Icon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PriceDisplay } from "@/components/site/price-display"
import { trackWebEvent } from "@/lib/analytics/tracker"
import { getNestAccessToken } from "@/lib/nest-api"
import {
  fetchRecommendations,
  recommendationsConfigured,
  type RecommendationCard,
  type RecommendationPage,
} from "@/lib/recommendations-api"
import { listingPath } from "@/lib/seo/paths"

function locationLabel(card: RecommendationCard): string {
  const { neighborhood, commune, city } = card.listing.location
  return [neighborhood.name, commune.name, city.name].filter(Boolean).join(", ")
}

function periodOf(
  period: string | undefined,
): "month" | "day" | "total" | "none" {
  if (period === "MONTH") return "month"
  if (period === "DAY") return "day"
  if (period === "TOTAL") return "total"
  return "none"
}

export function RecommendationsPanel() {
  const configured = recommendationsConfigured()
  const [page, setPage] = useState<RecommendationPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!configured) return
    startTransition(async () => {
      try {
        const data = await fetchRecommendations({
          listingType: "RENT",
          limit: 8,
          accessToken: getNestAccessToken(),
        })
        setPage(data)
        setError(null)
        if (data.items.length > 0) {
          trackWebEvent("recommendations_viewed", {
            recommendationRequestId: data.meta.requestId,
            algorithmVersion: data.meta.algorithmVersion,
            context:
              data.meta.context === "SIMILAR" ? "SIMILAR" : "PERSONALIZED",
            items: data.items.map((item, index) => ({
              listingId: item.listing.listingId,
              position: index + 1,
            })),
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
        setPage(null)
      }
    })
  }, [configured])

  if (!configured) {
    return (
      <section
        className="rounded-2xl border border-border bg-card/80 p-6"
        aria-labelledby="reco-heading"
      >
        <h2 id="reco-heading" className="text-xl font-semibold">
          Suggestions pour vous
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configurez <code className="text-xs">NEXT_PUBLIC_NEST_API_URL</code>{" "}
          pour afficher les recommandations de l’API Nest. La recherche
          classique reste disponible.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/locations" />}
        >
          Voir les locations
        </Button>
      </section>
    )
  }

  return (
    <section aria-labelledby="reco-heading" aria-busy={pending}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <SparklesIcon className="size-4" aria-hidden />
            Personnalisation
          </p>
          <h2 id="reco-heading" className="text-xl font-semibold sm:text-2xl">
            Suggestions pour vous
          </h2>
          {page ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Niveau {page.meta.level}
              {page.meta.degraded ? " · mode dégradé (règles)" : ""} ·{" "}
              {page.meta.algorithmVersion}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/assistant" />}
        >
          Affiner avec l’assistant
        </Button>
      </div>

      {pending && !page ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Chargement des suggestions…
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger les recommandations ({error}). Aucune annonce
          fictive n’est affichée.
        </p>
      ) : null}

      {page && page.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune annonce compatible pour le moment. Élargissez vos critères ou
          consultez la recherche classique.
        </p>
      ) : null}

      {page && page.items.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {page.items.map((item) => (
            <li key={item.listing.listingId}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--elevation-sm)]">
                <div className="aspect-[16/10] bg-muted">
                  {item.listing.mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.listing.mainImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {item.listing.price ? (
                    <PriceDisplay
                      amount={item.listing.price.amount}
                      period={periodOf(item.listing.price.period)}
                      size="sm"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Prix non renseigné
                    </p>
                  )}
                  <h3 className="line-clamp-2 text-sm font-semibold">
                    {item.listing.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {locationLabel(item)} · {item.listing.propertyType.name}
                  </p>
                  {item.reasons.length > 0 ? (
                    <ul className="flex flex-wrap gap-1">
                      {item.reasons.slice(0, 3).map((reason) => (
                        <Badge
                          key={reason.code}
                          variant="muted"
                          className="text-[10px]"
                        >
                          {reason.label}
                        </Badge>
                      ))}
                    </ul>
                  ) : null}
                  <Button
                    size="sm"
                    className="mt-auto w-fit"
                    nativeButton={false}
                    render={
                      <Link
                        href={listingPath(
                          item.listing.title,
                          item.listing.listingId,
                        )}
                        onClick={() => {
                          if (!page) return
                          trackWebEvent("recommended_listing_opened", {
                            recommendationRequestId: page.meta.requestId,
                            algorithmVersion: page.meta.algorithmVersion,
                            listingId: item.listing.listingId,
                            position:
                              page.items.findIndex(
                                (row) =>
                                  row.listing.listingId ===
                                  item.listing.listingId,
                              ) + 1,
                          })
                        }}
                      />
                    }
                  >
                    Voir l’annonce
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
