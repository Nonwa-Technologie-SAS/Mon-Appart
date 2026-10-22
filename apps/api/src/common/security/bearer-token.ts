import { timingSafeEqual } from "node:crypto"

/**
 * Compare un en-tête `Authorization: Bearer <token>` à un secret attendu
 * en temps constant. Refuse les valeurs vides ou de longueurs différentes.
 */
export function bearerMatches(
  authorization: string | undefined,
  expectedToken: string,
): boolean {
  const expected = expectedToken.trim()
  if (!expected || !authorization) return false
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim())
  if (!match) return false
  const provided = match[1]!
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
