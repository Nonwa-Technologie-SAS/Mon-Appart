import { describe, expect, it } from "vitest"

import { outboxRetryDelayMs, isPermanentOutboxError } from "./event-retry"
import {
  assertOutboxDraft,
  assertSafePayload,
  sanitizeOutboxError,
} from "./event-schema"

describe("contrat Outbox", () => {
  const valid = {
    name: "listing.published",
    producer: "listing",
    aggregateType: "listing",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: { listingId: "11111111-1111-4111-8111-111111111111" },
  }

  it("accepte un brouillon minimal", () => {
    expect(() => assertOutboxDraft(valid)).not.toThrow()
  })

  it("refuse un type d'événement invalide", () => {
    expect(() =>
      assertOutboxDraft({ ...valid, name: "ListingPublished" }),
    ).toThrow(/INVALID_EVENT/)
  })

  it("refuse un mot de passe dans le payload", () => {
    expect(() => assertSafePayload({ password: "secret" })).toThrow(
      /FORBIDDEN_PAYLOAD/,
    )
  })

  it("refuse un payload trop volumineux", () => {
    expect(() => assertSafePayload({ note: "x".repeat(20_000) })).toThrow(
      /PAYLOAD_TOO_LARGE/,
    )
  })

  it("masque une erreur trop longue", () => {
    expect(sanitizeOutboxError(new Error("a".repeat(500))).length).toBe(200)
  })
})

describe("retry Outbox", () => {
  it("augmente le délai avec un aléa borné", () => {
    const first = outboxRetryDelayMs(1, 5, () => 0.5)
    const second = outboxRetryDelayMs(3, 5, () => 0.5)
    expect(second).toBeGreaterThan(first)
  })

  it("classe les erreurs de schéma comme permanentes", () => {
    expect(isPermanentOutboxError(new Error("INVALID_EVENT: type"))).toBe(true)
    expect(isPermanentOutboxError(new Error("ECONNRESET"))).toBe(false)
  })
})
