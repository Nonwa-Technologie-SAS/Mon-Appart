import { Injectable } from "@nestjs/common"
import type { Suggestion, SuggestionType } from "@mon-appart/types"

import { DatabaseService } from "../../../database/database.service"
import { CatalogRepository } from "../../property"
import type { SuggestInput } from "../domain/search-engine"
import { normalizeText } from "../domain/text-normalizer"

/** Durée de vie de l'index en mémoire (référentiel + combinaisons en stock). */
const INDEX_TTL_MS = 60_000

const TYPE_PRIORITY: Record<SuggestionType, number> = {
  CITY: 0,
  LOCATION: 1,
  NEIGHBORHOOD: 2,
  PROPERTY_TYPE: 3,
  QUERY: 4,
}

interface Entry {
  suggestion: Suggestion
  normalized: string
  words: string[]
  /** Nombre d'annonces publiées (QUERY) ; départage à pertinence égale. */
  weight: number
}

interface InventoryRow {
  type_code: string
  type_name: string
  commune_code: string
  commune_name: string
  n: number
}

const words = (normalized: string) =>
  normalized.split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Autocomplétion sans SQL par frappe : un index en mémoire, reconstruit au
 * plus une fois par minute, couvre villes, communes, quartiers, types de biens
 * et combinaisons « type à commune » réellement en stock.
 */
@Injectable()
export class SuggestionProvider {
  private index: { entries: Entry[]; expiresAt: number } | null = null
  private building: Promise<Entry[]> | null = null

  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogRepository,
  ) {}

  async suggest(input: SuggestInput): Promise<Suggestion[]> {
    const tokens = words(input.normalized)
    if (tokens.length === 0) return []
    const entries = await this.entries()
    const scored: Array<{ entry: Entry; rank: number }> = []
    for (const entry of entries) {
      const rank = matchRank(entry, input.normalized, tokens)
      if (rank > 0) scored.push({ entry, rank })
    }
    scored.sort(
      (a, b) =>
        b.rank - a.rank ||
        TYPE_PRIORITY[a.entry.suggestion.type] -
          TYPE_PRIORITY[b.entry.suggestion.type] ||
        b.entry.weight - a.entry.weight ||
        a.entry.normalized.localeCompare(b.entry.normalized),
    )
    const seen = new Set<string>()
    const result: Suggestion[] = []
    for (const { entry } of scored) {
      const key = `${entry.suggestion.type}:${entry.normalized}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(entry.suggestion)
      if (result.length >= input.limit) break
    }
    return result
  }

  invalidate(): void {
    this.index = null
  }

  private async entries(): Promise<Entry[]> {
    if (this.index && this.index.expiresAt > Date.now())
      return this.index.entries
    this.building ??= this.build().finally(() => {
      this.building = null
    })
    return this.building
  }

  private async build(): Promise<Entry[]> {
    const [neighborhoods, types, inventory] = await Promise.all([
      this.catalog.neighborhoods(),
      this.catalog.propertyTypes(),
      this.inventory(),
    ])
    const entries: Entry[] = []
    const add = (suggestion: Suggestion, matchOn: string, weight = 0) => {
      const normalized = normalizeText(matchOn)
      entries.push({ suggestion, normalized, words: words(normalized), weight })
    }
    const cities = new Map<string, string>()
    const communes = new Map<string, { name: string; cityName: string }>()
    for (const entry of neighborhoods) {
      cities.set(entry.cityCode, entry.cityName)
      communes.set(entry.communeCode, {
        name: entry.communeName,
        cityName: entry.cityName,
      })
      add(
        {
          type: "NEIGHBORHOOD",
          label: `${entry.name}, ${entry.communeName}`,
          params: { commune: entry.communeCode, neighborhood: entry.code },
        },
        entry.name,
      )
    }
    for (const [code, name] of cities) {
      add({ type: "CITY", label: name, params: { city: code } }, name)
    }
    for (const [code, commune] of communes) {
      add(
        {
          type: "LOCATION",
          label: `${commune.name}, ${commune.cityName}`,
          params: { commune: code },
        },
        commune.name,
      )
    }
    for (const type of types) {
      if (!type.isActive) continue
      add(
        {
          type: "PROPERTY_TYPE",
          label: type.name,
          params: { propertyType: type.code },
        },
        type.name,
      )
    }
    for (const row of inventory) {
      const label = `${row.type_name} à ${row.commune_name}`
      add(
        {
          type: "QUERY",
          label,
          params: { propertyType: row.type_code, commune: row.commune_code },
        },
        label,
        row.n,
      )
    }
    this.index = { entries, expiresAt: Date.now() + INDEX_TTL_MS }
    return entries
  }

  /** Combinaisons type × commune ayant au moins une annonce publiée. */
  private inventory(): Promise<InventoryRow[]> {
    return this.db.client.$queryRaw<InventoryRow[]>`
      SELECT pt.code AS type_code, pt.name AS type_name,
             c.code AS commune_code, c.name AS commune_name, count(*)::int AS n
      FROM listings l
      JOIN properties p ON p.id = l.property_id
      JOIN property_types pt ON pt.id = p.property_type_id
      JOIN neighborhoods nb ON nb.id = p.neighborhood_id
      JOIN communes c ON c.id = nb.commune_id
      WHERE l.status = 'PUBLISHED' AND l.deleted_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
      GROUP BY pt.code, pt.name, c.code, c.name
      ORDER BY n DESC
      LIMIT 500
    `
  }
}

/**
 * 0 : pas de correspondance ; 2 : le libellé commence par la saisie ;
 * 1 : chaque mot saisi est le début d'un mot distinct du libellé.
 */
function matchRank(entry: Entry, normalized: string, tokens: string[]): number {
  if (entry.normalized.startsWith(normalized)) return 2
  const available = [...entry.words]
  for (const token of tokens) {
    const index = available.findIndex((word) => word.startsWith(token))
    if (index < 0) return 0
    available.splice(index, 1)
  }
  return 1
}
