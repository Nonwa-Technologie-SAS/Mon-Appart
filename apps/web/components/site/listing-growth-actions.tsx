"use client"

import { useEffect, useState, useTransition } from "react"
import { Heart, Link2, Share2 } from "lucide-react"

import {
  getFavoriteStatus,
  toggleFavorite,
} from "@/app/actions/favorites"
import { AuthRequiredCta } from "@/components/site/auth-required-cta"
import { Button } from "@/components/ui/button"
import { trackWebEvent } from "@/lib/analytics/tracker"

/**
 * Actions croissance sur fiche : vue détail, favori, partage.
 * Favori réservé aux comptes connectés (CUSTOMER ou éditeur).
 */
export function ListingGrowthActions({
  propertyId,
  propertyTitle,
  available,
  isAuthenticated,
}: {
  propertyId: string
  propertyTitle: string
  available: boolean
  isAuthenticated: boolean
}) {
  const [favorited, setFavorited] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [returnPath, setReturnPath] = useState(`/annonces/${propertyId}`)

  useEffect(() => {
    setReturnPath(window.location.pathname)
  }, [])

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
    if (!available || !isAuthenticated) return
    startTransition(async () => {
      const status = await getFavoriteStatus(propertyId)
      setFavorited(status.favorited)
    })
  }, [available, propertyId, isAuthenticated])

  function onFavorite() {
    if (!isAuthenticated) {
      setShowAuthGate(true)
      setMessage(null)
      return
    }
    startTransition(async () => {
      const result = await toggleFavorite(propertyId)
      if (result.requiresAuth) {
        setShowAuthGate(true)
        setMessage(result.error ?? "Connexion requise.")
        return
      }
      if (result.error) {
        setMessage(result.error)
        return
      }
      setShowAuthGate(false)
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
      {showAuthGate ? (
        <AuthRequiredCta
          nextPath={returnPath}
          reason="Créez un compte pour synchroniser vos favoris sur tous vos appareils."
        />
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
