import { describe, expect, it } from "vitest"

import { Tracker, type TrackerStorage, type TrackerTransport } from "./client"
import type { AnalyticsBatchInput } from "./validation"

const LISTING = "6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f"

function setup(statuses: Array<number | "network"> = []) {
  let clock = Date.parse("2026-10-13T08:00:00.000Z")
  let counter = 0
  const sent: AnalyticsBatchInput[] = []
  const drops: string[] = []
  const transport: TrackerTransport = {
    send(batch) {
      sent.push(structuredClone(batch))
      const status = statuses.shift() ?? 202
      if (status === "network") return Promise.reject(new Error("offline"))
      return Promise.resolve({ status })
    },
  }
  const store = new Map<string, string>()
  const storage: TrackerStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  }
  const tracker = new Tracker({
    source: "web",
    policyVersion: "2026-10",
    transport,
    storage,
    now: () => clock,
    randomId: () =>
      `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
    retryBaseMs: 1_000,
    maxAttempts: 3,
    onDrop: (name, reason) => drops.push(`${name}:${reason}`),
  })
  return {
    tracker,
    sent,
    drops,
    store,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

describe("Tracker", () => {
  it("n'enregistre rien sans consentement", async () => {
    const { tracker, sent, drops } = setup()
    expect(tracker.track("app_opened", {})).toBe(false)
    await tracker.flush()
    expect(sent).toHaveLength(0)
    expect(drops).toEqual(["app_opened:no_consent"])
  })

  it("regroupe les événements dans un lot avec contexte pseudonyme", async () => {
    const { tracker, sent, store } = setup()
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    tracker.track("page_viewed", { route: "/recherche" })
    await tracker.flush()
    expect(sent).toHaveLength(1)
    const batch = sent[0]!
    expect(batch.events.map((event) => event.name)).toEqual([
      "app_opened",
      "page_viewed",
    ])
    expect(batch.context.consent).toEqual({
      analytics: true,
      policyVersion: "2026-10",
    })
    expect(batch.context.sessionId).toBeDefined()
    expect(batch.context.anonymousId).toBeDefined()
    expect(store.size).toBe(1)
    expect(tracker.pending).toBe(0)
  })

  it("ignore les doublons d'un rerender ou d'une navigation répétée", async () => {
    const { tracker, sent, drops, advance } = setup()
    await tracker.setConsent(true)
    const view = { listingId: LISTING, source: "SEARCH" } as const
    expect(tracker.track("listing_detail_viewed", view)).toBe(true)
    expect(tracker.track("listing_detail_viewed", view)).toBe(false)
    advance(31 * 60_000)
    expect(tracker.track("listing_detail_viewed", view)).toBe(true)
    await tracker.flush()
    expect(sent[0]!.events).toHaveLength(2)
    expect(drops).toEqual(["listing_detail_viewed:duplicate"])
  })

  it("refuse localement un événement serveur ou mal formé", async () => {
    const { tracker, drops } = setup()
    await tracker.setConsent(true)
    // @ts-expect-error événement réservé au backend
    expect(tracker.track("appointment_confirmed", {})).toBe(false)
    expect(
      // @ts-expect-error propriété hors schéma
      tracker.track("page_viewed", { route: "/", email: "a@b.ci" }),
    ).toBe(false)
    expect(drops).toEqual([
      "appointment_confirmed:invalid_event",
      "page_viewed:invalid_event",
    ])
  })

  it("rejoue un échec temporaire avec le même eventId", async () => {
    const { tracker, sent, advance } = setup(["network", 503, 202])
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    await tracker.flush()
    advance(1_000)
    await tracker.flush()
    advance(2_000)
    await tracker.flush()
    expect(sent).toHaveLength(3)
    const ids = sent.map((batch) => batch.events[0]!.eventId)
    expect(new Set(ids).size).toBe(1)
    expect(tracker.pending).toBe(0)
  })

  it("respecte le délai de reprise", async () => {
    const { tracker, sent, advance } = setup([500])
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    await tracker.flush()
    advance(500)
    await tracker.flush()
    expect(sent).toHaveLength(1)
  })

  it("abandonne après le nombre maximal d'essais", async () => {
    const { tracker, drops, advance } = setup([500, 500, 500])
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    for (let attempt = 0; attempt < 3; attempt++) {
      await tracker.flush()
      advance(10_000)
    }
    expect(tracker.pending).toBe(0)
    expect(drops).toEqual(["app_opened:retries_exhausted"])
  })

  it("abandonne un lot refusé définitivement (4xx)", async () => {
    const { tracker, drops } = setup([413])
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    await tracker.flush()
    expect(tracker.pending).toBe(0)
    expect(drops).toEqual(["app_opened:rejected_by_server"])
  })

  it("borne la file en écartant les plus anciens", async () => {
    const { tracker, drops } = setup()
    await tracker.setConsent(true)
    for (let index = 0; index < 205; index++) {
      tracker.track("search_filter_applied", {
        filter: index % 2 === 0 ? "PRICE" : "COMMUNE",
      })
    }
    expect(tracker.pending).toBe(200)
    expect(drops.filter((drop) => drop.endsWith("queue_full"))).toHaveLength(5)
  })

  it("oublie la file et l'identifiant pseudonyme au retrait du consentement", async () => {
    const { tracker, store, sent } = setup()
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    await tracker.flush()
    tracker.track("page_viewed", { route: "/" })
    await tracker.setConsent(false)
    await tracker.flush()
    expect(tracker.pending).toBe(0)
    expect(store.size).toBe(0)
    expect(sent).toHaveLength(1)
  })

  it("renouvelle l'identifiant pseudonyme après sa durée de vie", async () => {
    const { tracker, sent, advance } = setup()
    await tracker.setConsent(true)
    tracker.track("app_opened", {})
    await tracker.flush()
    const first = sent[0]!.context.anonymousId
    advance(60 * 60_000)
    tracker.track("page_viewed", { route: "/" })
    await tracker.flush()
    expect(sent[1]!.context.anonymousId).toBe(first)
    advance(31 * 24 * 60 * 60_000)
    tracker.track("page_viewed", { route: "/recherche" })
    await tracker.flush()
    expect(sent[2]!.context.anonymousId).not.toBe(first)
  })
})
