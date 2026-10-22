import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

const ALGO = "aes-256-gcm"

export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}

export function parseSecretsKey(hex: string | null | undefined): Buffer | null {
  if (!hex) return null
  const trimmed = hex.trim()
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return null
  return Buffer.from(trimmed, "hex")
}

/** Format stocké : base64(iv 12 || tag 16 || cipher). */
export function encryptSecret(key: Buffer, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptSecret(key: Buffer, cipherText: string): string {
  const raw = Buffer.from(cipherText, "base64")
  if (raw.length < 28) throw new Error("cipher_malformed")
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const data = raw.subarray(28)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  )
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("base64url")
}
