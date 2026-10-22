"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { ChevronDownIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { PROPERTY_TYPE_OPTIONS } from "@/lib/format"
import { cn } from "@/lib/utils"

type HeroSearchProps = {
  initialQ?: string
  initialType?: string
  initialMaxPrice?: string
  compact?: boolean
  leading?: ReactNode
}

export function HeroSearch({
  initialQ = "",
  initialType = "",
  initialMaxPrice = "",
  compact = false,
  leading,
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
        className="flex w-full flex-col gap-3 lg:flex-row lg:items-center"
        role="search"
      >
        {leading}
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Ville ou quartier</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="address-level2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par ville, quartier…"
            className="min-h-11 rounded-full border-border bg-white pl-10"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="compact-maxPrice">
            Budget maximum
          </label>
          <PillSelect
            id="compact-maxPrice"
            name="maxPrice"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value)
              applyFilters({ maxPrice: e.target.value })
            }}
            className="min-h-11 w-[min(100%,11rem)] sm:w-44"
          >
            <option value="">Tout prix</option>
            <option value="500000">Jusqu’à 500 000 F CFA</option>
            <option value="800000">Jusqu’à 800 000 F CFA</option>
            <option value="1200000">Jusqu’à 1 200 000 F CFA</option>
            <option value="2500000">Jusqu’à 2 500 000 F CFA</option>
          </PillSelect>
          <label className="sr-only" htmlFor="compact-type">
            Type de bien
          </label>
          <PillSelect
            id="compact-type"
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              applyFilters({ type: e.target.value })
            }}
            className="min-h-11 w-[min(100%,11rem)] sm:w-40"
          >
            <option value="">Tous types</option>
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </PillSelect>
          <Button
            type="submit"
            disabled={isPending}
            className="min-h-11 min-w-11 rounded-full px-4"
          >
            <SearchIcon data-icon="inline-start" />
            <span className="sm:inline">{isPending ? "…" : "OK"}</span>
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-white p-3 shadow-sm md:flex-row md:items-end"
    >
      <label className="flex flex-1 flex-col gap-1.5 px-1">
        <span className="text-xs font-medium text-muted-foreground">
          Destination
        </span>
        <Input
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="address-level2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ville, quartier…"
          className="min-h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1.5 px-1 md:max-w-44">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <NativeSelect
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
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
        <span className="text-xs font-medium text-muted-foreground">
          Budget max
        </span>
        <Input
          name="maxPrice"
          type="number"
          inputMode="numeric"
          min={0}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="F CFA / mois"
          className="min-h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </label>
      <Button
        type="submit"
        disabled={isPending}
        className="min-h-11 w-full shrink-0 gap-2 md:w-auto"
        size="lg"
      >
        <SearchIcon data-icon="inline-start" />
        {isPending ? "Recherche…" : "Rechercher"}
      </Button>
    </form>
  )
}

export function PillSelect({
  className,
  ...props
}: React.ComponentProps<typeof NativeSelect>) {
  return (
    <div className="relative">
      <NativeSelect
        className={cn(
          "min-h-11 appearance-none rounded-full border-border bg-white pr-9 pl-4 text-sm",
          className
        )}
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
