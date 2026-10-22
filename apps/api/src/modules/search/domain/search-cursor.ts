import {
  SEARCH_SORTS,
  type SearchEngineName,
  type SearchSort,
} from "@mon-appart/types"

import { searchError, SearchErrorCode } from "./search-errors"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Curseur opaque et versionné. `key` est la valeur de tri du dernier élément
 * (relue en SQL avec le bon type), `id` son identifiant public (départage
 * stable), `asOf` fige la fraîcheur du score entre les pages, `hash` lie le
 * curseur aux filtres qui l'ont produit et `engine` au moteur (formats de clé
 * différents).
 */
export interface SearchCursor {
  sort: SearchSort
  key: string | null
  id: string
  asOf: Date
  hash: string
  fuzzy: boolean
  engine: SearchEngineName
}

interface Encoded {
  v: 1
  s: SearchSort
  k: string | null
  id: string
  t: string
  h: string
  f: 0 | 1
  e: "pg" | "os"
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  const payload: Encoded = {
    v: 1,
    s: cursor.sort,
    k: cursor.key,
    id: cursor.id,
    t: cursor.asOf.toISOString(),
    h: cursor.hash,
    f: cursor.fuzzy ? 1 : 0,
    e: cursor.engine === "opensearch" ? "os" : "pg",
  }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

/** Rejette tout curseur mal formé, d'une autre version ou d'une autre recherche. */
export function decodeSearchCursor(
  raw: string,
  expected: { sort: SearchSort; hash: string },
): SearchCursor {
  const fail = () => searchError(SearchErrorCode.INVALID_CURSOR)
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(raw)) throw fail()
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
  } catch {
    throw fail()
  }
  if (typeof parsed !== "object" || parsed === null) throw fail()
  const value = parsed as Partial<Encoded>
  const asOf = typeof value.t === "string" ? new Date(value.t) : null
  const valid =
    value.v === 1 &&
    SEARCH_SORTS.includes(value.s as SearchSort) &&
    (value.k === null ||
      // Relue en SQL (::float8, ::numeric, ::timestamptz) : nombres ou horodatages seulement.
      (typeof value.k === "string" && /^[0-9eE+\-.: ]{1,64}$/.test(value.k))) &&
    typeof value.id === "string" &&
    UUID.test(value.id) &&
    asOf !== null &&
    !Number.isNaN(asOf.getTime()) &&
    typeof value.h === "string" &&
    (value.f === 0 || value.f === 1) &&
    (value.e === "pg" || value.e === "os")
  if (!valid) throw fail()
  if (value.s !== expected.sort || value.h !== expected.hash) throw fail()
  return {
    sort: value.s!,
    key: value.k ?? null,
    id: value.id!,
    asOf: asOf!,
    hash: value.h!,
    fuzzy: value.f === 1,
    engine: value.e === "os" ? "opensearch" : "postgres",
  }
}
