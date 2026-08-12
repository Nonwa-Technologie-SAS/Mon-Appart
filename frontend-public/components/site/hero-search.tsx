"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { PROPERTY_TYPE_OPTIONS } from "@/lib/format"

type HeroSearchProps = {
  initialQ?: string
  initialType?: string
  initialMaxPrice?: string
  compact?: boolean
}

export function HeroSearch({
  initialQ = "",
  initialType = "",
  initialMaxPrice = "",
  compact = false,
}: HeroSearchProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const [type, setType] = useState(initialType)
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice)

  function applyFilters(next?: {
    q?: string
    type?: string
    maxPrice?: string
  }) {
    const nextQ = next?.q ?? q
    const nextType = next?.type ?? type
    const nextMaxPrice = next?.maxPrice ?? maxPrice
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set("q", nextQ.trim())
    if (nextType) params.set("type", nextType)
    if (nextMaxPrice) params.set("maxPrice", nextMaxPrice)

    if (typeof window !== "undefined" && !nextQ.trim()) {
      const current = new URLSearchParams(window.location.search)
      const lat = current.get("lat")
      const lng = current.get("lng")
      if (lat) params.set("lat", lat)
      if (lng) params.set("lng", lng)
    }

    startTransition(() => {
      const qs = params.toString()
      router.push(qs ? `/?${qs}` : "/")
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    applyFilters()
  }

  if (compact) {
    return (
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-3 md:flex-row md:items-center"
      >
        <label className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par ville, quartier…"
            className="h-11 rounded-full border-border bg-white pl-9 shadow-none"
          />
        </label>
        <NativeSelect
          name="maxPrice"
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value)
            applyFilters({ maxPrice: e.target.value })
          }}
          className="h-11 w-full rounded-full border-border bg-white px-4 md:w-40"
        >
          <option value="">Tout prix</option>
          <option value="500000">Jusqu’à 500 000 F CFA</option>
          <option value="800000">Jusqu’à 800 000 F CFA</option>
          <option value="1200000">Jusqu’à 1 200 000 F CFA</option>
          <option value="2500000">Jusqu’à 2 500 000 F CFA</option>
        </NativeSelect>
        <NativeSelect
          name="type"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            applyFilters({ type: e.target.value })
          }}
          className="h-11 w-full rounded-full border-border bg-white px-4 md:w-44"
        >
          <option value="">Tous types</option>
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="submit"
          disabled={isPending}
          variant="outline"
          className="h-11 rounded-full px-4"
        >
          <SlidersHorizontalIcon data-icon="inline-start" />
          {isPending ? "Recherche…" : "Plus"}
        </Button>
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="animate-search-rise mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur-sm md:flex-row md:items-end"
    >
      <label className="flex flex-1 flex-col gap-1.5 px-1">
        <span className="text-xs font-medium text-muted-foreground">Destination</span>
        <Input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ville, quartier…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1.5 px-1 md:max-w-44">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <NativeSelect
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        >
          <option value="">Tous</option>
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex flex-1 flex-col gap-1.5 px-1 md:max-w-40">
        <span className="text-xs font-medium text-muted-foreground">Budget max</span>
        <Input
          name="maxPrice"
          type="number"
          min={0}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="F CFA / mois"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </label>
      <Button
        type="submit"
        disabled={isPending}
        className="h-11 shrink-0 gap-2 md:w-auto"
        size="lg"
      >
        <SearchIcon data-icon="inline-start" />
        {isPending ? "Recherche…" : "Rechercher"}
      </Button>
    </form>
  )
}
