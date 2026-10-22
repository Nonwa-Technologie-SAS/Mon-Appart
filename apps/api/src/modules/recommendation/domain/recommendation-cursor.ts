import type { RecommendationContext } from "@mon-appart/types"
import { createHash } from "node:crypto"

import {
  recommendationError,
  RecommendationErrorCode,
} from "./recommendation-errors"

/**
 * Curseur opaque : position dans la liste classée, instant de calcul (le même
 * classement est reproduit si le cache a expiré) et empreinte de la requête.
 */
export interface RecommendationCursor {
  context: RecommendationContext
  offset: number
  asOf: Date
  hash: string
}

interface Encoded {
  v: 1
  c: "P" | "S"
  o: number
  t: string
  h: string
}

const MAX_OFFSET = 10_000

export function encodeRecommendationCursor(
  cursor: RecommendationCursor,
): string {
  const payload: Encoded = {
    v: 1,
    c: cursor.context === "SIMILAR" ? "S" : "P",
    o: cursor.offset,
    t: cursor.asOf.toISOString(),
    h: cursor.hash,
  }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

/** Rejette tout curseur mal formé, d'un autre contexte ou d'une autre requête. */
export function decodeRecommendationCursor(
  raw: string,
  expected: { context: RecommendationContext; hash: string },
): RecommendationCursor {
  const fail = () => recommendationError(RecommendationErrorCode.INVALID_CURSOR)
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
    (value.c === "P" || value.c === "S") &&
    Number.isInteger(value.o) &&
    value.o! > 0 &&
    value.o! <= MAX_OFFSET &&
    asOf !== null &&
    !Number.isNaN(asOf.getTime()) &&
    typeof value.h === "string"
  if (!valid) throw fail()
  const context = value.c === "S" ? "SIMILAR" : "PERSONALIZED"
  if (context !== expected.context || value.h !== expected.hash) throw fail()
  return { context, offset: value.o!, asOf: asOf!, hash: value.h! }
}

/** Empreinte courte et stable d'un objet (clés triées). */
export function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (typeof value === "bigint") return JSON.stringify(value.toString())
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`
  }
  return JSON.stringify(value ?? null)
}
