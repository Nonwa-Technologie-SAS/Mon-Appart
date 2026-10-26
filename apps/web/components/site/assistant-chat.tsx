"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import Link from "next/link"
import {
  HeartIcon,
  Loader2Icon,
  MapPinIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  classicSearchHref,
  criteriaChips,
  nestApiBaseUrl,
  sendConversationMessage,
  sendNaturalSearch,
  suggestionAction,
  type AssistantListingCard,
  type AssistantTurn,
} from "@/lib/assistant-api"
import { PriceDisplay } from "@/components/site/price-display"
import { listingPath } from "@/lib/seo/paths"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Maison 3 chambres à louer à Cocody, budget 250 000 FCFA par mois",
  "Appartement à louer à Abidjan",
  "Terrain à Cocody",
  "Studio Angré max 150k",
]

type ChatRow =
  { kind: "user"; text: string } | { kind: "assistant"; turn: AssistantTurn }

function CriteriaChips({
  turn,
  onClearChip,
}: {
  turn: AssistantTurn
  onClearChip?: (label: string) => void
}) {
  const chips = criteriaChips(turn.criteria)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Critères détectés">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-primary/40"
          title={onClearChip ? `Affiner : ${chip}` : undefined}
          onClick={() => onClearChip?.(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

function ModeBanner({
  turn,
  onForceSearch,
  classicHref,
}: {
  turn: AssistantTurn
  onForceSearch: () => void
  classicHref: string
}) {
  if (turn.mode === "clarify") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Précisez ou lancez quand même avec les critères déjà connus.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onForceSearch}>
            Lancer la recherche
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={classicHref} />}
          >
            Recherche classique
          </Button>
        </div>
      </div>
    )
  }
  if (turn.mode === "empty") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-3 py-3">
        <p className="text-sm font-medium">Aucune annonce pour ces critères</p>
        <p className="text-xs text-muted-foreground">
          Élargissez le budget ou la zone, ou parcourez toutes les locations.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onForceSearch()}
          >
            Relancer sans filtre strict
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/locations" />}
          >
            Voir les locations
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={classicHref} />}
          >
            Ouvrir les filtres
          </Button>
        </div>
      </div>
    )
  }
  if (turn.mode === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3"
      >
        <p className="text-sm font-medium text-destructive">
          Recherche temporairement indisponible
        </p>
        <p className="text-xs text-muted-foreground">
          Vos critères sont conservés. Passez à la recherche classique — aucune
          annonce n’a été inventée.
        </p>
        <Button
          type="button"
          size="sm"
          nativeButton={false}
          render={<Link href={classicHref || "/locations"} />}
        >
          Recherche classique
        </Button>
      </div>
    )
  }
  return null
}

function ListingMiniCard({
  listing,
  selected,
  onToggle,
}: {
  listing: AssistantListingCard
  selected: boolean
  onToggle: () => void
}) {
  const href = listingPath(listing.title, listing.listingId)
  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-3 shadow-[var(--elevation-sm)]",
        selected ? "border-primary" : "border-border",
      )}
    >
      <div className="flex gap-3">
        <Link
          href={href}
          className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"
        >
          {listing.mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.mainImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-muted-foreground">
              <MapPinIcon className="size-5" aria-hidden />
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          {listing.price ? (
            <PriceDisplay
              amount={listing.price.amount}
              period={
                listing.price.period === "MONTH"
                  ? "month"
                  : listing.price.period === "DAY"
                    ? "day"
                    : "total"
              }
              size="sm"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Prix non renseigné</p>
          )}
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold">
            <Link href={href} className="hover:underline">
              {listing.title}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {listing.locationLabel}
            {listing.bedrooms != null ? ` · ${listing.bedrooms} ch.` : ""}
            {listing.surface != null ? ` · ${listing.surface} m²` : ""}
            {" · "}
            {listing.propertyType.name}
          </p>
          {listing.matchReasons.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {listing.matchReasons.slice(0, 3).map((r) => (
                <Badge key={r} variant="muted" className="text-[10px]">
                  {r}
                </Badge>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="min-h-9"
              nativeButton={false}
              render={<Link href={href} />}
            >
              Voir
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-9"
              nativeButton={false}
              render={
                <Link
                  href={`${href}?from=assistant#visite`}
                  aria-label="Demander une visite"
                />
              }
            >
              Visite
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-9"
              nativeButton={false}
              render={
                <Link
                  href={`/connexion?next=${encodeURIComponent(href)}`}
                  aria-label="Enregistrer en favori"
                />
              }
            >
              <HeartIcon className="size-3.5" aria-hidden />
              Favori
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selected ? "default" : "ghost"}
              className="min-h-9"
              onClick={onToggle}
              aria-pressed={selected}
            >
              {selected ? "Comparé" : "Comparer"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function AssistantChat() {
  const formId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<ChatRow[]>([])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const apiConfigured = nestApiBaseUrl() !== null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [rows, pending])

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  function submit(text: string, forceSearch = false) {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    setRows((r) => [...r, { kind: "user", text: message }])
    setInput("")

    startTransition(async () => {
      try {
        const turn = conversationId
          ? await sendConversationMessage(conversationId, message, {
              forceSearch,
            })
          : await sendNaturalSearch(message, { forceSearch })
        setConversationId(turn.conversationId)
        setRows((r) => [...r, { kind: "assistant", turn }])
      } catch (err) {
        const code = err instanceof Error ? err.message : "Erreur"
        if (code === "NEST_API_UNCONFIGURED") {
          setError(
            "L’assistant n’est pas branché à l’API. Utilisez la recherche classique.",
          )
        } else {
          setError(
            "Impossible de joindre l’assistant pour le moment. Réessayez ou utilisez la recherche classique.",
          )
        }
      }
    })
  }

  function handleSuggestion(suggestion: string, turn: AssistantTurn) {
    const action = suggestionAction(suggestion)
    if (action === "forceSearch") {
      submit(suggestion, true)
      return
    }
    if (action === "classic") {
      window.location.href = classicSearchHref(turn.searchParams)
      return
    }
    submit(suggestion)
  }

  function refineFromChip(chip: string) {
    setInput((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${chip}` : chip
      return next
    })
    inputRef.current?.focus()
  }

  const lastTurn =
    [...rows].reverse().find((r) => r.kind === "assistant")?.turn ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {!apiConfigured ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            L’assistant nécessite l’API Nest. En attendant, la recherche
            classique reste disponible.
          </p>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/locations" />}
          >
            <SearchIcon className="size-3.5" aria-hidden />
            Locations
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Exemples de recherche"
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending || !apiConfigured}
              onClick={() => submit(s)}
              className="rounded-full border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="flex min-h-[280px] flex-col gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-[var(--elevation-sm)]"
        aria-live="polite"
        aria-busy={pending}
      >
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <SparklesIcon className="size-8 text-primary" aria-hidden />
            <p className="max-w-md text-sm font-medium text-foreground">
              Décrivez le logement en français
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Lieu, budget en F CFA, type de bien. Nous clarifions si besoin,
              puis affichons uniquement des annonces publiées sur Mon Appart.
            </p>
          </div>
        ) : (
          rows.map((row, i) =>
            row.kind === "user" ? (
              <div key={`u-${i}`} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {row.text}
                </p>
              </div>
            ) : (
              <div key={`a-${i}`} className="flex flex-col gap-3">
                <p className="max-w-[95%] rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed">
                  {row.turn.message}
                </p>

                <CriteriaChips turn={row.turn} onClearChip={refineFromChip} />

                <ModeBanner
                  turn={row.turn}
                  classicHref={classicSearchHref(row.turn.searchParams)}
                  onForceSearch={() => {
                    const prompt =
                      row.turn.mode === "empty"
                        ? "Élargir la recherche"
                        : "Lancer la recherche"
                    submit(prompt, true)
                  }}
                />

                {row.turn.listings.length > 0 ? (
                  <div className="grid gap-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {row.turn.listings.length} annonce
                      {row.turn.listings.length > 1 ? "s" : ""} trouvée
                      {row.turn.listings.length > 1 ? "s" : ""}
                    </p>
                    {row.turn.listings.map((listing) => (
                      <ListingMiniCard
                        key={listing.listingId}
                        listing={listing}
                        selected={compareIds.includes(listing.listingId)}
                        onToggle={() => toggleCompare(listing.listingId)}
                      />
                    ))}
                  </div>
                ) : null}

                {row.turn.suggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {row.turn.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={pending}
                        onClick={() => handleSuggestion(s, row.turn)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}

                {Object.keys(row.turn.searchParams).length > 0 &&
                row.turn.mode === "results" ? (
                  <p className="text-xs text-muted-foreground">
                    <Link
                      href={classicSearchHref(row.turn.searchParams)}
                      className="text-primary underline underline-offset-2"
                    >
                      Voir ces filtres en recherche classique
                    </Link>
                  </p>
                ) : null}
              </div>
            ),
          )
        )}
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Analyse et recherche en cours…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-destructive">{error}</p>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/locations" />}
          >
            Recherche classique
          </Button>
        </div>
      ) : null}

      {compareIds.length >= 2 && lastTurn ? (
        <p className="text-sm text-muted-foreground">
          {compareIds.length} biens sélectionnés — ouvrez chaque fiche pour le
          détail (données Search uniquement).
        </p>
      ) : null}

      {lastTurn && criteriaChips(lastTurn.criteria).length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Critères actifs — cliquez pour affiner dans le champ
          </p>
          <CriteriaChips turn={lastTurn} onClearChip={refineFromChip} />
        </div>
      ) : null}

      <form
        id={formId}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <label className="sr-only" htmlFor={`${formId}-input`}>
          Votre demande immobilière
        </label>
        <textarea
          ref={inputRef}
          id={`${formId}-input`}
          rows={2}
          value={input}
          disabled={pending || !apiConfigured}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit(input)
            }
          }}
          placeholder="Ex. Appartement 2 chambres à Marcory, max 180 000 / mois"
          className="min-h-12 flex-1 resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex gap-2">
          {lastTurn?.mode === "clarify" ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || !apiConfigured}
              className="touch-target shrink-0"
              onClick={() =>
                submit(input.trim() || "Lancer la recherche", true)
              }
            >
              Lancer
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={pending || !apiConfigured || !input.trim()}
            className="touch-target shrink-0"
          >
            <SendIcon className="size-4" aria-hidden />
            Envoyer
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3 text-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRows([])
            setConversationId(null)
            setCompareIds([])
            setError(null)
            inputRef.current?.focus()
          }}
        >
          Nouvelle conversation
        </Button>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/locations" />}
        >
          Recherche classique
        </Button>
      </div>
    </div>
  )
}
