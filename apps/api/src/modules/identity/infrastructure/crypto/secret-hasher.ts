import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export type HashPurpose =
  | "refresh-token"
  | "password-reset"
  | "otp-code"
  | "otp-destination"
  | "rate-limit"

/**
 * HMAC-SHA256 avec séparation par usage. Les secrets à forte entropie
 * (refresh token, lien de réinitialisation) n'ont pas besoin d'Argon2 ; un OTP
 * à 6 chiffres reste protégé hors ligne par la clé serveur.
 */
export class SecretHasher {
  constructor(private readonly key: Buffer) {}

  hash(purpose: HashPurpose, value: string): string {
    return createHmac("sha256", this.key)
      .update(`${purpose}\u0000${value}`)
      .digest("hex")
  }

  matches(purpose: HashPurpose, value: string, expectedHex: string): boolean {
    const actual = Buffer.from(this.hash(purpose, value), "hex")
    const expected = Buffer.from(expectedHex, "hex")
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    )
  }
}

/** Jeton opaque URL-safe (256 bits par défaut). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
