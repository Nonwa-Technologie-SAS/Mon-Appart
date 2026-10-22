import { describe, expect, it } from "vitest"

import {
  budgetBucket,
  CLIENT_EVENT_NAMES,
  EVENT_NAMES,
  EVENTS,
  SERVER_EVENT_NAMES,
} from "./catalog"
import { batchSchema, findForbiddenKey, validateEvent } from "./validation"

const LISTING = "6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f"
const REQUEST = "0b6c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d"

describe("catalogue", () => {
  it("fige les noms et versions publiés (compatibilité)", () => {
    const versions = Object.fromEntries(
      EVENT_NAMES.map((name) => [name, EVENTS[name].version]),
    )
    // Retirer un événement ou changer sa version casse les clients existants :
    // ajouter une version et garder l'ancienne dans `legacy`.
    expect(versions).toMatchInlineSnapshot(`
      {
        "acquisition_touch": 1,
        "app_opened": 1,
        "appointment_cancelled": 1,
        "appointment_completed": 1,
        "appointment_confirmed": 1,
        "appointment_requested": 1,
        "checkout_started": 1,
        "conversation_created": 1,
        "email_verification_completed": 1,
        "listing_card_viewed": 1,
        "listing_contact_started": 1,
        "listing_contact_submitted": 1,
        "listing_creation_completed": 1,
        "listing_creation_started": 1,
        "listing_detail_viewed": 1,
        "listing_expired": 1,
        "listing_favorited": 1,
        "listing_gallery_interacted": 1,
        "listing_marked_as_rented": 1,
        "listing_marked_as_sold": 1,
        "listing_paused": 1,
        "listing_published": 1,
        "listing_report_submitted": 1,
        "listing_shared": 1,
        "listing_unfavorited": 1,
        "listing_updated": 1,
        "map_results_viewed": 1,
        "message_reply_received": 1,
        "message_sent": 1,
        "owner_onboarding_completed": 1,
        "page_viewed": 1,
        "payment_attempt_created": 1,
        "payment_failed": 1,
        "payment_succeeded": 1,
        "phone_verification_completed": 1,
        "profile_completed": 1,
        "qualified_lead_recorded": 1,
        "recommendation_converted": 1,
        "recommendation_dismissed": 1,
        "recommendation_feedback_submitted": 1,
        "recommendations_requested": 1,
        "recommendations_viewed": 1,
        "recommended_listing_opened": 1,
        "refund_completed": 1,
        "refund_requested": 1,
        "registration_completed": 1,
        "search_filter_applied": 1,
        "search_results_viewed": 1,
        "search_sort_changed": 1,
        "search_submitted": 1,
        "search_suggestion_selected": 1,
        "subscription_cancelled": 1,
        "subscription_renewed": 1,
        "subscription_started": 1,
      }
    `)
  })

  it("utilise des noms snake_case et sépare client et serveur", () => {
    for (const name of EVENT_NAMES) expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/)
    expect(CLIENT_EVENT_NAMES.length + SERVER_EVENT_NAMES.length).toBe(
      EVENT_NAMES.length,
    )
  })

  it("réserve les conversions au backend", () => {
    for (const name of [
      "listing_contact_submitted",
      "appointment_requested",
      "appointment_confirmed",
      "appointment_completed",
      "qualified_lead_recorded",
      "recommendation_converted",
      "listing_published",
      "search_submitted",
    ] as const) {
      expect(EVENTS[name].origin).toBe("server")
    }
  })

  it("déclare une clé d'annonce présente dans le schéma", () => {
    for (const name of EVENT_NAMES) {
      const key = (EVENTS[name] as { listingKey?: string }).listingKey
      if (key) expect(Object.keys(EVENTS[name].schema.shape)).toContain(key)
    }
  })
})

describe("validateEvent", () => {
  it("accepte un événement client valide", () => {
    const result = validateEvent(
      "listing_detail_viewed",
      1,
      { listingId: LISTING, source: "SEARCH" },
      "client",
    )
    expect(result.ok).toBe(true)
  })

  it("refuse un nom inconnu, une version absente et une propriété en trop", () => {
    expect(validateEvent("click", 1, {}, "client")).toEqual({
      ok: false,
      reason: "unknown_event",
    })
    expect(validateEvent("app_opened", 2, {}, "client")).toEqual({
      ok: false,
      reason: "unsupported_version",
    })
    expect(
      validateEvent("app_opened", 1, { screen: "home" }, "client"),
    ).toEqual({ ok: false, reason: "invalid_properties" })
  })

  it("refuse qu'un client émette un événement métier", () => {
    expect(
      validateEvent(
        "appointment_confirmed",
        1,
        { listingId: LISTING, appointmentId: REQUEST },
        "client",
      ),
    ).toEqual({ ok: false, reason: "server_only_event" })
  })

  it("refuse les clés sensibles, même imbriquées", () => {
    expect(
      validateEvent(
        "page_viewed",
        1,
        { route: "/", email: "a@b.ci" },
        "client",
      ),
    ).toEqual({ ok: false, reason: "forbidden_property" })
    expect(findForbiddenKey({ items: [{ accessToken: "x" }] })).toBe(
      "accessToken",
    )
    expect(findForbiddenKey({ listingId: LISTING, position: 2 })).toBeNull()
    expect(findForbiddenKey({ user_email: "x" })).toBe("user_email")
    expect(
      findForbiddenKey({ context: "SIMILAR", description: "x" }),
    ).toBeNull()
    expect(
      validateEvent(
        "listing_card_viewed",
        1,
        { listingId: LISTING, context: "SEARCH", position: 1 },
        "client",
      ).ok,
    ).toBe(true)
  })

  it("refuse les propriétés trop volumineuses", () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      listingId: LISTING,
      position: index + 1,
      padding: "x".repeat(40),
    }))
    expect(
      validateEvent(
        "recommendations_viewed",
        1,
        {
          recommendationRequestId: REQUEST,
          algorithmVersion: "rules-1",
          context: "PERSONALIZED",
          items,
        },
        "client",
      ),
    ).toEqual({ ok: false, reason: "properties_too_large" })
  })

  it("n'accepte que des routes normalisées", () => {
    const route = (value: string) =>
      validateEvent("page_viewed", 1, { route: value }, "client").ok
    expect(route("/annonces/[id]")).toBe(true)
    expect(route("/recherche")).toBe(true)
    expect(route("/annonces/6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f")).toBe(false)
    expect(route("/profil/0707070707")).toBe(false)
    expect(route("/recherche?q=cocody")).toBe(false)
    expect(route("https://monappart.ci/")).toBe(false)
  })
})

describe("batchSchema", () => {
  const batch = {
    context: {
      source: "web",
      consent: { analytics: true, policyVersion: "2026-10" },
      sentAt: "2026-10-13T08:00:00.000Z",
    },
    events: [
      {
        eventId: REQUEST,
        name: "app_opened",
        schemaVersion: 1,
        occurredAt: "2026-10-13T08:00:00.000Z",
      },
    ],
  }

  it("accepte un lot minimal", () => {
    expect(batchSchema.safeParse(batch).success).toBe(true)
  })

  it("refuse un champ de contexte inconnu (pas d'empreinte)", () => {
    const tampered = {
      ...batch,
      context: { ...batch.context, userAgent: "Mozilla" },
    }
    expect(batchSchema.safeParse(tampered).success).toBe(false)
  })

  it("refuse un lot trop grand", () => {
    const events = Array.from({ length: 101 }, () => batch.events[0])
    expect(batchSchema.safeParse({ ...batch, events }).success).toBe(false)
  })
})

describe("budgetBucket", () => {
  it("range un montant dans une tranche, jamais le montant exact", () => {
    expect(budgetBucket(80_000)).toBe("UNDER_100K")
    expect(budgetBucket(250_000)).toBe("250K_500K")
    expect(budgetBucket(150_000_000)).toBe("OVER_100M")
    expect(budgetBucket(null)).toBeNull()
    expect(budgetBucket(-1)).toBeNull()
  })
})
