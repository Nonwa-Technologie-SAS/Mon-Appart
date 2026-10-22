import { describe, expect, it } from "vitest"

import {
  decryptSecret,
  encryptSecret,
  fingerprintSecret,
  generateWebhookSecret,
  parseSecretsKey,
} from "./partner-secrets"

describe("partner-secrets", () => {
  const key = parseSecretsKey("a".repeat(64))!

  it("chiffre et déchiffre un secret", () => {
    const secret = generateWebhookSecret()
    const cipher = encryptSecret(key, secret)
    expect(cipher).not.toContain(secret)
    expect(decryptSecret(key, cipher)).toBe(secret)
    expect(fingerprintSecret(secret)).toHaveLength(64)
  })

  it("refuse une clé mal formée", () => {
    expect(parseSecretsKey("short")).toBeNull()
    expect(parseSecretsKey(null)).toBeNull()
  })
})
