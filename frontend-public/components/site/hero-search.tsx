"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { SearchIcon } from "lucide-react"

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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (type) params.set("type", type)
    if (maxPrice) params.set("maxPrice", maxPrice)

    startTransition(() => {
      router.push(`/recherche?${params.toString()}`)
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? "flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-end"
          : "animate-search-rise mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur-sm md:flex-row md:items-end"
      }
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
          placeholder="€ / mois"
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
