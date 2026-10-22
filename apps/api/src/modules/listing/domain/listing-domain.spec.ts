import { describe, expect, it } from "vitest"

import { closingInstant, validatePrice } from "./listing-price"
import {
  assertPublishable,
  computeExpiry,
  needsNewPublicationDate,
  type PublicationCheck,
} from "./listing-publication"
import { isTransitionAllowed, transitionActors } from "./listing-status"

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

describe("matrice de statut des annonces", () => {
  it("DRAFT → PUBLISHED est valide, DRAFT → SOLD ne l'est pas", () => {
    expect(isTransitionAllowed("DRAFT", "PUBLISHED", "RENT")).toBe(true)
    expect(codeOf(() => transitionActors("DRAFT", "SOLD", "SALE"))).toBe(
      "INVALID_LISTING_STATUS_TRANSITION",
    )
  })

  it("PUBLISHED → PAUSED → PUBLISHED, puis RENTED ou SOLD selon le type", () => {
    expect(isTransitionAllowed("PUBLISHED", "PAUSED", "RENT")).toBe(true)
    expect(isTransitionAllowed("PAUSED", "PUBLISHED", "RENT")).toBe(true)
    expect(isTransitionAllowed("PUBLISHED", "RENTED", "RENT")).toBe(true)
    expect(isTransitionAllowed("PUBLISHED", "SOLD", "SALE")).toBe(true)
    expect(isTransitionAllowed("PUBLISHED", "SOLD", "RENT")).toBe(false)
    expect(isTransitionAllowed("PUBLISHED", "RENTED", "SALE")).toBe(false)
    expect(isTransitionAllowed("PUBLISHED", "RENTED", "SHORT_TERM_RENT")).toBe(
      false,
    )
    expect(isTransitionAllowed("PUBLISHED", "SOLD", "LEASE_TO_OWN")).toBe(true)
  })

  it("donne des erreurs explicites pour les doublons et les annonces conclues", () => {
    expect(
      codeOf(() => transitionActors("PUBLISHED", "PUBLISHED", "RENT")),
    ).toBe("LISTING_ALREADY_PUBLISHED")
    expect(codeOf(() => transitionActors("SOLD", "PUBLISHED", "SALE"))).toBe(
      "LISTING_ALREADY_SOLD",
    )
    expect(codeOf(() => transitionActors("SOLD", "SOLD", "SALE"))).toBe(
      "LISTING_ALREADY_SOLD",
    )
    expect(isTransitionAllowed("SOLD", "ARCHIVED", "SALE")).toBe(true)
  })

  it("réserve la validation de revue et la suspension à la modération", () => {
    expect(transitionActors("PENDING_REVIEW", "PUBLISHED", "RENT")).toEqual([
      { kind: "moderator", permission: "listing:moderate" },
    ])
    expect(transitionActors("PUBLISHED", "SUSPENDED", "RENT")).toEqual([
      { kind: "moderator", permission: "listing:suspend" },
    ])
    expect(transitionActors("PUBLISHED", "EXPIRED", "RENT")).toEqual([
      { kind: "system" },
    ])
  })

  it("ne sort jamais d'ARCHIVED", () => {
    expect(isTransitionAllowed("ARCHIVED", "PUBLISHED", "RENT")).toBe(false)
    expect(isTransitionAllowed("ARCHIVED", "DRAFT", "RENT")).toBe(false)
  })
})

describe("prix", () => {
  it("accepte un loyer mensuel et une vente au total en XOF", () => {
    expect(
      validatePrice("RENT", { amount: 1_500_000, period: "MONTH" }),
    ).toEqual({
      amount: 1_500_000,
      period: "MONTH",
      currency: "XOF",
    })
    expect(
      validatePrice("SALE", { amount: 50_000_000, period: "TOTAL" }).currency,
    ).toBe("XOF")
  })

  it("refuse montant nul, négatif, décimal ou devise autre que XOF", () => {
    for (const amount of [0, -1, 1500.5]) {
      expect(
        codeOf(() => validatePrice("RENT", { amount, period: "MONTH" })),
      ).toBe("INVALID_PRICE")
    }
    expect(
      codeOf(() =>
        validatePrice("RENT", {
          amount: 1000,
          period: "MONTH",
          currency: "EUR",
        }),
      ),
    ).toBe("INVALID_PRICE")
  })

  it("refuse une période incohérente avec le type d'offre", () => {
    expect(
      codeOf(() => validatePrice("SALE", { amount: 1000, period: "MONTH" })),
    ).toBe("INVALID_PRICE")
    expect(
      codeOf(() => validatePrice("RENT", { amount: 1000, period: "TOTAL" })),
    ).toBe("INVALID_PRICE")
    expect(() =>
      validatePrice("SHORT_TERM_RENT", { amount: 25_000, period: "DAY" }),
    ).not.toThrow()
  })

  it("clôture toujours après le début de validité", () => {
    const start = new Date("2026-10-08T10:00:00.000Z")
    expect(closingInstant(start, start).getTime()).toBe(start.getTime() + 1)
    const later = new Date("2026-10-08T11:00:00.000Z")
    expect(closingInstant(start, later)).toEqual(later)
  })
})

describe("publication", () => {
  const ready: PublicationCheck = {
    listingTitle: "Villa Cocody",
    hasCurrentPrice: true,
    propertyStatus: "ACTIVE",
    propertyDeleted: false,
    propertyMissing: [],
  }

  it("exige bien actif, bien complet, titre et prix", () => {
    expect(() => assertPublishable(ready)).not.toThrow()
    expect(
      codeOf(() => assertPublishable({ ...ready, propertyStatus: "DRAFT" })),
    ).toBe("PROPERTY_NOT_ACTIVE")
    expect(
      codeOf(() =>
        assertPublishable({ ...ready, propertyMissing: ["surface"] }),
      ),
    ).toBe("LISTING_INCOMPLETE")
    expect(
      codeOf(() => assertPublishable({ ...ready, hasCurrentPrice: false })),
    ).toBe("NO_ACTIVE_PRICE")
  })

  it("calcule l'échéance : demandée, conservée ou par défaut", () => {
    const now = new Date("2026-10-08T10:00:00.000Z")
    const day = 24 * 60 * 60 * 1000
    expect(computeExpiry({ now, current: null, defaultDays: 90 })).toEqual(
      new Date(now.getTime() + 90 * day),
    )
    const current = new Date(now.getTime() + 10 * day)
    expect(computeExpiry({ now, current, defaultDays: 90 })).toEqual(current)
    expect(
      codeOf(() =>
        computeExpiry({
          now,
          requested: new Date(now.getTime() + 400 * day),
          current: null,
          defaultDays: 90,
        }),
      ),
    ).toBe("INVALID_EXPIRY")
  })

  it("garde la date de publication à la reprise d'une pause", () => {
    const publishedAt = new Date()
    expect(needsNewPublicationDate("PAUSED", publishedAt)).toBe(false)
    expect(needsNewPublicationDate("EXPIRED", publishedAt)).toBe(true)
    expect(needsNewPublicationDate("DRAFT", null)).toBe(true)
  })
})
