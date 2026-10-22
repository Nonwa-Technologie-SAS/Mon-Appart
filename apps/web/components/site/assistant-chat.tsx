"use client"

import { useId, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2Icon, SendIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  classicSearchHref,
  nestApiBaseUrl,
  sendConversationMessage,
  sendNaturalSearch,
  type AssistantListingCard,
  type AssistantTurn,
} from "@/lib/assistant-api"
import { PriceDisplay } from "@/components/site/price-display"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Maison 3 chambres à louer à Cocody, budget 250 000 FCFA par mois",
  "Appartement à louer à Abidjan",
  "Terrain à Cocody",
  "Studio Angré max 150k",
]

type ChatRow =
  | { kind: "user"; text: string }
  | { kind: "assistant"; turn: AssistantTurn }

function ListingMiniCard({
  listing,
  selected,
  onToggle,
}: {
  listing: AssistantListingCard
  selected: boolean
  onToggle: () => void
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-3 shadow-[var(--elevation-sm)]",
        selected ? "border-primary" : "border-border",
      )}
    >
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {listing.mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.mainImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
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
            {listing.title}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {listing.locationLabel} · {listing.propertyType.name}
          </p>
          {listing.matchReasons.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {listing.matchReasons.slice(0, 3).map((r) => (
                <Badge key={r} variant="muted" className="text-[10px]">
                  {r}
                </Badge>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              onClick={onToggle}
              aria-pressed={selected}
            >
              {selected ? "Sélectionné" : "Comparer"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/biens/${listing.listingId}`} />}
            >
              Voir la fiche
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
  const [rows, setRows] = useState<ChatRow[]>([])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const apiConfigured = nestApiBaseUrl() !== null

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
            "L’API Nest n’est pas configurée (NEXT_PUBLIC_NEST_API_URL). La recherche classique reste disponible.",
          )
        } else {
          setError(code)
        }
      }
    })
  }

  const lastTurn =
    [...rows].reverse().find((r) => r.kind === "assistant")?.turn ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {!apiConfigured ? (
        <div
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          Configurez <code className="text-xs">NEXT_PUBLIC_NEST_API_URL</code>{" "}
          pour parler à l’assistant. En attendant, utilisez la{" "}
          <Link href="/" className="font-medium text-primary underline">
            recherche classique
          </Link>
          .
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2" aria-label="Suggestions">
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

      <div
        className="flex min-h-[280px] flex-col gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-[var(--elevation-sm)]"
        aria-live="polite"
        aria-busy={pending}
      >
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <SparklesIcon className="size-8 text-primary" aria-hidden />
            <p className="max-w-md text-sm text-muted-foreground">
              Décrivez le bien recherché en français. L’assistant extrait des
              critères, clarifie si besoin, puis interroge les annonces
              réellement publiées — jamais inventées.
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
                {row.turn.listings.length > 0 ? (
                  <div className="grid gap-3">
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
                        onClick={() => {
                          if (s.toLowerCase().includes("lancer")) {
                            submit(s, true)
                          } else if (s.toLowerCase().includes("classique")) {
                            window.location.href = classicSearchHref(
                              row.turn.searchParams,
                            )
                          } else {
                            submit(s)
                          }
                        }}
                        className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
                {Object.keys(row.turn.searchParams).length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Filtres Search :{" "}
                    <Link
                      href={classicSearchHref(row.turn.searchParams)}
                      className="text-primary underline"
                    >
                      ouvrir en recherche classique
                    </Link>
                    {" · "}
                    fournisseur {row.turn.provider}
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
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {compareIds.length >= 2 && lastTurn ? (
        <p className="text-sm text-muted-foreground">
          {compareIds.length} biens sélectionnés pour comparaison — ouvrez
          chaque fiche pour le détail (données issues de Search uniquement).
        </p>
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
        <Button
          type="submit"
          disabled={pending || !apiConfigured || !input.trim()}
          className="touch-target shrink-0"
        >
          <SendIcon className="size-4" aria-hidden />
          Envoyer
        </Button>
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
