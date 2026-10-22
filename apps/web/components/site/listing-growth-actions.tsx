"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Heart, Link2, Share2 } from "lucide-react"

import {
  getFavoriteStatus,
  toggleFavorite,
} from "@/app/actions/favorites"
import { Button } from "@/components/ui/button"
import { trackWebEvent } from "@/lib/analytics/tracker"

/**
 * Actions croissance sur fiche : vue détail, favori, partage.
 * Les IDs web sont des property UUID (stack legacy) — documentés comme tels.
 */
export function ListingGrowthActions({
  propertyId,
  propertyTitle,
  available,
}: {
  propertyId: string
  propertyTitle: string
  available: boolean
}) {
  const [favorited, setFavorited] = useState(false)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!available) return
    const params = new URLSearchParams(window.location.search)
    const from = params.get("from")
    const source =
      from === "search"
        ? "SEARCH"
        : from === "reco"
          ? "RECOMMENDATION"
          : from === "share"
            ? "SHARE"
            : "DIRECT"
    trackWebEvent("listing_detail_viewed", {
      listingId: propertyId,
      source,
    })
  }, [available, propertyId])

  useEffect(() => {
    if (!available) return
    startTransition(async () => {
      const status = await getFavoriteStatus(propertyId)
      setFavorited(status.favorited)
      setRequiresAuth(Boolean(status.requiresAuth))
    })
  }, [available, propertyId])

  function onFavorite() {
    startTransition(async () => {
      const result = await toggleFavorite(propertyId)
      if (result.requiresAuth) {
        setRequiresAuth(true)
        setMessage(result.error ?? "Connexion requise.")
        return
      }
      if (result.error) {
        setMessage(result.error)
        return
      }
      setFavorited(result.favorited)
      setMessage(
        result.favorited ? "Ajouté aux favoris." : "Retiré des favoris.",
      )
    })
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    try {
      if (navigator.share) {
        await navigator.share({ title: propertyTitle, url })
        trackWebEvent("listing_shared", {
          listingId: propertyId,
          channel: "NATIVE",
        })
        return
      }
      await navigator.clipboard.writeText(url)
      trackWebEvent("listing_shared", {
        listingId: propertyId,
        channel: "COPY_LINK",
      })
      setMessage("Lien copié.")
    } catch {
      setMessage("Partage annulé.")
    }
  }

  if (!available) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={favorited ? "default" : "outline"}
          size="sm"
          className="min-h-11"
          disabled={pending}
          onClick={onFavorite}
          aria-pressed={favorited}
        >
          <Heart
            className={favorited ? "fill-current" : undefined}
            aria-hidden
          />
          {favorited ? "Favori" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => void onShare()}
        >
          <Share2 aria-hidden />
          Partager
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href)
            trackWebEvent("listing_shared", {
              listingId: propertyId,
              channel: "COPY_LINK",
            })
            setMessage("Lien copié.")
          }}
        >
          <Link2 aria-hidden />
          Copier le lien
        </Button>
      </div>
      {requiresAuth ? (
        <p className="text-xs text-muted-foreground">
          <Link
            href={`/connexion?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
            className="underline underline-offset-2"
          >
            Connectez-vous
          </Link>{" "}
          pour synchroniser vos favoris.
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
