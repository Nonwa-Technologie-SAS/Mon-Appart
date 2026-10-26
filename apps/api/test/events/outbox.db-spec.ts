import { randomUUID } from "node:crypto"

import { EventEmitter2 } from "@nestjs/event-emitter"

import { InboxService } from "../../src/common/events/inbox.service"
import { OutboxDispatcher } from "../../src/common/events/outbox.dispatcher"
import { OutboxService } from "../../src/common/events/outbox.service"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"
import {
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"

const VILLA_PRICE = { amount: 1_500_000, period: "MONTH" }

describe("Outbox transactionnelle", () => {
  let test: IdentityTestApp
  let owner: TestUser

  beforeAll(async () => {
    test = await createIdentityApp()
    owner = await userWithRoles(test, ["OWNER"])
  })

  afterAll(async () => {
    await test.close()
  })

  it("écrit listing.created dans l'outbox et le publie après commit", async () => {
    const events = test.app.get(EventEmitter2)
    const received: string[] = []
    const listener = (event: { name: string }) => received.push(event.name)
    events.on("listing.created", listener)
    try {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const row = await test.db.query<{
        status: string
        event_type: string
        payload: { listingId: string }
      }>(
        `SELECT status, event_type, payload
           FROM outbox_events
          WHERE aggregate_id = $1 AND event_type = 'listing.created'
          ORDER BY id DESC LIMIT 1`,
        [listing],
      )
      expect(row.rows[0]?.status).toBe("PUBLISHED")
      expect(row.rows[0]?.payload.listingId).toBe(listing)
      expect(received).toContain("listing.created")
    } finally {
      events.off("listing.created", listener)
    }
  })

  it("n'écrit pas d'outbox si la transaction métier échoue", async () => {
    const before = await test.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM outbox_events`,
    )
    await test.http
      .post("/api/v1/listings")
      .set(owner.auth)
      .send({
        propertyId: "00000000-0000-4000-8000-000000000001",
        listingType: "RENT",
      })
      .expect(404)
    const after = await test.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM outbox_events`,
    )
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n)
  })

  it("déduplique un événement déjà vu par l'inbox", async () => {
    const inbox = test.app.get(InboxService)
    const eventId = randomUUID()
    expect(await inbox.claim("search.indexer", eventId)).toBe(true)
    expect(await inbox.claim("search.indexer", eventId)).toBe(false)
    expect(await inbox.alreadyProcessed("search.indexer", eventId)).toBe(true)
  })

  it("republie un événement PENDING via le dispatcher", async () => {
    const eventId = randomUUID()
    const listingId = randomUUID()
    await test.db.query(
      `INSERT INTO outbox_events (
         event_id, event_type, producer, aggregate_type, aggregate_id,
         payload, occurred_at, status, next_attempt_at
       ) VALUES (
         $1::uuid, 'listing.updated', 'listing', 'listing', $2::uuid,
         $3::jsonb, now(), 'PENDING', now()
       )`,
      [
        eventId,
        listingId,
        JSON.stringify({ listingId, changedFields: ["title"] }),
      ],
    )
    const events = test.app.get(EventEmitter2)
    const received: string[] = []
    const listener = (event: { id: string }) => received.push(event.id)
    events.on("listing.updated", listener)
    try {
      const published = await test.app.get(OutboxDispatcher).runOnce(20)
      expect(published).toBeGreaterThanOrEqual(1)
      expect(received).toContain(eventId)
      const row = await test.db.query<{ status: string }>(
        `SELECT status FROM outbox_events WHERE event_id = $1`,
        [eventId],
      )
      expect(row.rows[0]?.status).toBe("PUBLISHED")
    } finally {
      events.off("listing.updated", listener)
    }
  })

  it("expose OutboxService pour un append atomique", async () => {
    expect(test.app.get(OutboxService)).toBeDefined()
  })
})
