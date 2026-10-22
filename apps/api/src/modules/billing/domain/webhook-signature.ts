import { createHash, createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signature HMAC-SHA256 d'un corps brut, horodatée : `t=<unix>,v1=<hex>` sur
 * `<t>.<corps>`. Le secret n'est jamais journalisé ni renvoyé ; la comparaison
 * est à temps constant et l'horodatage borne le rejeu.
 */
export function signPayload(
  secret: string,
  rawBody: Buffer | string,
  timestampSeconds: number,
): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestampSeconds}.`)
    .update(rawBody)
    .digest("hex")
  return `t=${timestampSeconds},v1=${mac}`
}

export type SignatureCheck =
  | { valid: true }
  | { valid: false; reason: "MISSING" | "MALFORMED" | "STALE" | "MISMATCH" }

export function verifySignature(
  secret: string,
  rawBody: Buffer,
  header: string | undefined,
  nowSeconds: number,
  toleranceSeconds: number,
): SignatureCheck {
  if (!header) return { valid: false, reason: "MISSING" }
  const parts = new Map<string, string>()
  for (const part of header.split(",")) {
    const index = part.indexOf("=")
    if (index > 0)
      parts.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  const timestamp = Number(parts.get("t"))
  const received = parts.get("v1") ?? ""
  if (!Number.isSafeInteger(timestamp) || !/^[0-9a-f]{64}$/.test(received)) {
    return { valid: false, reason: "MALFORMED" }
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { valid: false, reason: "STALE" }
  }
  const expected = signPayload(secret, rawBody, timestamp).slice(
    `t=${timestamp},v1=`.length,
  )
  const match = timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  )
  return match ? { valid: true } : { valid: false, reason: "MISMATCH" }
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex")
}
