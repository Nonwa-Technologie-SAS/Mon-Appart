import { randomBytes } from "node:crypto"

import type {
  MediaType,
  MediaVariantKind,
} from "../../../generated/prisma/enums"

/**
 * Clés de stockage générées par le serveur uniquement. Le client ne fournit
 * jamais de chemin : `o/` originaux privés, `q/` documents en quarantaine,
 * `v/` variantes produites par le traitement.
 */
const KEY_PATTERN =
  /^(o|q|v)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9]{1,64}\.[a-z0-9]{2,5}$/

export function originalKey(
  mediaPublicId: string,
  type: MediaType,
  extension: string,
  random: string = randomBytes(16).toString("hex"),
): string {
  const prefix = type === "DOCUMENT" ? "q" : "o"
  return assertSafeKey(`${prefix}/${mediaPublicId}/${random}.${extension}`)
}

/** Déterministe : retraiter un média réécrit ses propres variantes, rien d'autre. */
export function variantKey(
  mediaPublicId: string,
  kind: MediaVariantKind,
  extension: string,
): string {
  return assertSafeKey(`v/${mediaPublicId}/${kind.toLowerCase()}.${extension}`)
}

export function isSafeKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

/** Refuse toute clé hors du format : traversée, chemin absolu, caractère exotique. */
export function assertSafeKey(key: string): string {
  if (!isSafeKey(key)) throw new Error("Clé de stockage invalide")
  return key
}

/** Identifiant public du média porté par une clé, pour la détection d'orphelins. */
export function mediaIdOfKey(key: string): string | null {
  return isSafeKey(key) ? key.split("/")[1]! : null
}
