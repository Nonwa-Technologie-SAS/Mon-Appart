import { randomUUID } from "node:crypto"

import { AggregationService } from "../../src/modules/analytics/application/aggregation.service"
import { AnalyticsWorker } from "../../src/modules/analytics/application/analytics-worker"
import { RetentionService } from "../../src/modules/analytics/application/retention.service"
import { AnalyticsConfig } from "../../src/modules/analytics/analytics.config"
import {
  addDays,
  deterministicEventId,
  isoDay,
  utcDay,
} from "../../src/modules/analytics/domain/ingestion-rules"
import {
  assign,
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"

const SECRET_BODY = "Mon code de portail est 4821, appelez-moi au 0700000000"

async function eventually<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (done(value) || Date.now() > deadline) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

describe("Analytics : collecte, instrumentation, agrégats, accès", () => {
  let test: IdentityTestApp
  let policy: string
  let owner: TestUser
  let otherOwner: TestUser
  let agent: TestUser
  let customer: TestUser
  let admin: TestUser
  let propertyId: string
  let listingId: string
  let draftId: string

  const batch = (
    events: Array<Record<string, unknown>>,
    context: Record<string, unknown> = {},
  ) => ({
    context: {
      source: "web",
      sessionId: randomUUID(),
      consent: { analytics: true, policyVersion: policy },
      sentAt: new Date().toISOString(),
      ...context,
    },
    events: events.map((event) => ({
      eventId: randomUUID(),
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      properties: {},
      ...event,
    })),
  })

  const detailView = (id: string, extra: Record<string, unknown> = {}) => ({
    name: "listing_detail_viewed",
    properties: { listingId: id, source: "SEARCH" },
    ...extra,
  })

  const post = (body: unknown, user?: TestUser) => {
    const req = test.http.post("/api/v1/analytics/events")
    return (user ? req.set(user.auth) : req).send(body as object)
  }

  const eventsOf = async (where: string, params: unknown[]) =>
    (
      await test.db.query<{
        name: string
        source: string
        basis: string
        user_id: string | null
        anonymous_id: string | null
        properties: Record<string, unknown>
      }>(
        `SELECT name, source::text, basis::text, user_id::text, anonymous_id::text, properties
         FROM analytics_events WHERE ${where} ORDER BY id`,
        params,
      )
    ).rows

  const listingEvents = (id: string, name: string) =>
    eventsOf(
      "listing_id = (SELECT id FROM listings WHERE public_id = $1) AND name = $2",
      [id, name],
    )

  beforeAll(async () => {
    test = await createIdentityApp()
    policy = test.app.get(AnalyticsConfig).policyVersion
    owner = await userWithRoles(test, ["OWNER"])
    otherOwner = await userWithRoles(test, ["OWNER"])
    agent = await userWithRoles(test, ["AGENT"])
    customer = await userWithRoles(test, ["CUSTOMER"])
    admin = await userWithRoles(test, ["ADMIN"])
    propertyId = await createProperty(test, owner)
    listingId = await createListing(test, owner, propertyId, "RENT", {
      amount: 250_000,
      period: "MONTH",
    })
    await test.http
      .post(`/api/v1/listings/${listingId}/publish`)
      .set(owner.auth)
      .send({})
      .expect(200)
    const draftProperty = await createProperty(test, owner)
    draftId = await createListing(test, owner, draftProperty, "SALE")
    await assign(test, propertyId, agent.userId, "AGENT")
  })

  afterAll(async () => {
    await test.close()
  })

  describe("ingestion client", () => {
    it("enregistre un lot consenti puis ignore son renvoi (idempotence)", async () => {
      const anonymousId = randomUUID()
      const body = batch(
        [
          detailView(listingId),
          { name: "page_viewed", properties: { route: "/annonces/[id]" } },
        ],
        { anonymousId },
      )
      const first = await post(body).expect(202)
      expect(first.body).toEqual({
        accepted: 2,
        duplicates: 0,
        ignored: 0,
        rejected: [],
      })
      const again = await post(body).expect(202)
      expect(again.body).toEqual({
        accepted: 0,
        duplicates: 2,
        ignored: 0,
        rejected: [],
      })
      const rows = await eventsOf("anonymous_id = $1", [anonymousId])
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({
        source: "WEB",
        basis: "CONSENT",
        user_id: null,
      })
    })

    it("ignore tout le lot sans consentement déclaré ou d'une autre politique", async () => {
      const anonymousId = randomUUID()
      const refused = await post(
        batch([detailView(listingId)], {
          anonymousId,
          consent: { analytics: false, policyVersion: policy },
        }),
      ).expect(202)
      expect(refused.body).toMatchObject({ accepted: 0, ignored: 1 })
      const stale = await post(
        batch([detailView(listingId)], {
          anonymousId,
          consent: { analytics: true, policyVersion: "1999-01" },
        }),
      ).expect(202)
      expect(stale.body).toMatchObject({ accepted: 0, ignored: 1 })
      expect(await eventsOf("anonymous_id = $1", [anonymousId])).toEqual([])
    })

    it("refuse les faits métier déclarés par le client et les données interdites", async () => {
      const response = await post(
        batch([
          {
            name: "listing_contact_submitted",
            properties: { listingId, conversationId: randomUUID() },
          },
          { name: "qualified_lead_recorded", properties: {} },
          { name: "page_viewed", properties: { route: "/x", email: "a@b.ci" } },
          {
            name: "page_viewed",
            properties: { route: "https://site.ci/?token=abc" },
          },
          { name: "mouse_moved", properties: {} },
          {
            name: "page_viewed",
            schemaVersion: 9,
            properties: { route: "/x" },
          },
          {
            name: "page_viewed",
            properties: { route: "/x" },
            occurredAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
          },
        ]),
      ).expect(202)
      expect(response.body.accepted).toBe(0)
      expect(
        (response.body.rejected as Array<{ reason: string }>).map(
          (r) => r.reason,
        ),
      ).toEqual([
        "server_only_event",
        "server_only_event",
        "forbidden_property",
        "invalid_properties",
        "unknown_event",
        "unsupported_version",
        "out_of_window",
      ])
    })

    it("rejette un lot mal formé (400) sans rien écrire", async () => {
      const bad = await post({ context: { source: "web" }, events: [] }).expect(
        400,
      )
      expect(bad.body.code).toBe("ANALYTICS_BATCH_INVALID")
      await post(
        batch([detailView(listingId)], { userId: "42", ip: "1.2.3.4" }),
      ).expect(400)
      const tooMany = batch(
        Array.from({ length: 101 }, () => ({ name: "app_opened" })),
      )
      await post(tooMany).expect(400)
    })

    it("ne mesure ni les annonces non publiées, ni la propre annonce de l'émetteur", async () => {
      const anonymousId = randomUUID()
      const draft = await post(
        batch([detailView(draftId)], { anonymousId }),
      ).expect(202)
      expect(draft.body).toMatchObject({ accepted: 0, ignored: 1 })

      await test.http
        .put("/api/v1/analytics/consent")
        .set(owner.auth)
        .send({ granted: true, policyVersion: policy, source: "web" })
        .expect(200)
      const own = await post(batch([detailView(listingId)]), owner).expect(202)
      expect(own.body).toMatchObject({ accepted: 0, ignored: 1 })
    })

    it("un compte connecté sans consentement enregistré n'est pas mesuré", async () => {
      const user = await userWithRoles(test, ["CUSTOMER"])
      const response = await post(batch([{ name: "app_opened" }]), user).expect(
        202,
      )
      expect(response.body).toMatchObject({ accepted: 0, ignored: 1 })
    })
  })

  describe("consentement", () => {
    it("distingue absence, accord et retrait ; le retrait efface la navigation collectée", async () => {
      const initial = await test.http
        .get("/api/v1/analytics/consent")
        .set(customer.auth)
        .expect(200)
      expect(initial.body).toMatchObject({
        status: "UNSET",
        currentPolicyVersion: policy,
      })

      const mismatch = await test.http
        .put("/api/v1/analytics/consent")
        .set(customer.auth)
        .send({ granted: true, policyVersion: "1999-01", source: "web" })
        .expect(422)
      expect(mismatch.body.code).toBe("CONSENT_POLICY_MISMATCH")

      await test.http
        .put("/api/v1/analytics/consent")
        .set(customer.auth)
        .send({ granted: true, policyVersion: policy, source: "mobile" })
        .expect(200)
      const anonymousId = randomUUID()
      const sent = await post(
        batch([detailView(listingId)], { anonymousId, source: "mobile" }),
        customer,
      ).expect(202)
      expect(sent.body.accepted).toBe(1)
      const stored = await eventsOf(
        "user_id = (SELECT id FROM users WHERE public_id = $1) AND basis = 'CONSENT'",
        [customer.userId],
      )
      expect(stored).toHaveLength(1)
      // Pas de rapprochement entre l'identifiant anonyme et le compte.
      expect(stored[0]!.anonymous_id).toBeNull()

      const withdrawn = await test.http
        .put("/api/v1/analytics/consent")
        .set(customer.auth)
        .send({ granted: false, policyVersion: policy, source: "web" })
        .expect(200)
      expect(withdrawn.body.status).toBe("DENIED")
      expect(
        await eventsOf(
          "user_id = (SELECT id FROM users WHERE public_id = $1) AND basis = 'CONSENT'",
          [customer.userId],
        ),
      ).toEqual([])
      const audit = await test.db.query<{ action: string }>(
        "SELECT action FROM audit_logs WHERE entity_id = $1 AND action LIKE 'ANALYTICS_%' ORDER BY id",
        [customer.userId],
      )
      expect(audit.rows.map((row) => row.action)).toEqual([
        "ANALYTICS_CONSENT_GRANTED",
        "ANALYTICS_CONSENT_WITHDRAWN",
      ])
      await post(batch([{ name: "app_opened" }]), customer)
        .expect(202)
        .expect(({ body }) => expect(body.ignored).toBe(1))
    })

    it("exige une connexion", async () => {
      await test.http.get("/api/v1/analytics/consent").expect(401)
    })
  })

  describe("instrumentation métier (backend, après l'action réelle)", () => {
    it("trace la publication d'une annonce", async () => {
      const rows = await eventually(
        () => listingEvents(listingId, "listing_published"),
        (r) => r.length > 0,
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        source: "BACKEND",
        basis: "LEGITIMATE_INTEREST",
        properties: { listingId },
      })
    })

    it("contact, réponse et lead qualifié ; jamais le contenu des messages", async () => {
      const buyer = await userWithRoles(test, ["CUSTOMER"])
      const created = await test.http
        .post("/api/v1/conversations")
        .set(buyer.auth)
        .send({ listingId, message: SECRET_BODY })
        .expect(201)
      const conversationId: string = created.body.conversation.id
      await test.http
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(owner.auth)
        .send({ body: `Réponse : ${SECRET_BODY}` })
        .expect(201)

      const leads = await eventually(
        () => listingEvents(listingId, "qualified_lead_recorded"),
        (r) =>
          r.some((row) => row.properties.conversationId === conversationId),
      )
      expect(
        leads.filter((row) => row.properties.conversationId === conversationId),
      ).toHaveLength(1)
      const submitted = await listingEvents(
        listingId,
        "listing_contact_submitted",
      )
      expect(
        submitted.some(
          (row) => row.properties.conversationId === conversationId,
        ),
      ).toBe(true)
      const replies = await listingEvents(listingId, "message_reply_received")
      expect(
        replies.find((row) => row.properties.conversationId === conversationId),
      ).toBeDefined()

      // Une seconde réponse ne crée ni nouvelle « première réponse » ni nouveau lead.
      await test.http
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(owner.auth)
        .send({ body: "Autre précision" })
        .expect(201)
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(
        (await listingEvents(listingId, "qualified_lead_recorded")).filter(
          (row) => row.properties.conversationId === conversationId,
        ),
      ).toHaveLength(1)

      const dump = await test.db.query<{ text: string }>(
        "SELECT coalesce(string_agg(properties::text, ' '), '') AS text FROM analytics_events",
      )
      expect(dump.rows[0]!.text).not.toContain("4821")
      expect(dump.rows[0]!.text).not.toContain("0700000000")
    })

    it("trace la recherche par codes, sans le texte saisi", async () => {
      const marker = `zz${Date.now()}`
      await test.http
        .get("/api/v1/search")
        .query({
          q: `villa ${marker}`,
          commune: "COCODY",
          listingType: "RENT",
          submit: "true",
        })
        .expect(200)
      const isMine = (row: { properties: Record<string, unknown> }) =>
        row.properties.commune === "COCODY" &&
        row.properties.listingType === "RENT" &&
        (row.properties.filters as string[]).includes("TEXT")
      const rows = await eventually(
        () =>
          eventsOf(
            "name = 'search_submitted' AND occurred_at > now() - interval '1 minute'",
            [],
          ),
        (r) => r.some(isMine),
      )
      const json = JSON.stringify(rows)
      expect(json).not.toContain(marker)
      const mine = rows.find(isMine)
      expect(mine?.properties).toMatchObject({
        commune: "COCODY",
        listingType: "RENT",
        filters: expect.arrayContaining(["TEXT", "COMMUNE", "LISTING_TYPE"]),
      })
    })
  })

  describe("agrégats rejouables", () => {
    const day = addDays(utcDay(new Date()), -5)
    let viewers: string[]

    beforeAll(async () => {
      viewers = [randomUUID(), randomUUID(), randomUUID()]
      const at = new Date(day.getTime() + 10 * 3_600_000).toISOString()
      const actors = [...viewers, viewers[0]!]
      for (const [index, anonymousId] of actors.entries()) {
        await test.db.query(
          `INSERT INTO analytics_events
             (event_id, name, schema_version, source, basis, policy_version,
              occurred_at, anonymous_id, listing_id, properties)
           SELECT $1::uuid, 'listing_detail_viewed', 1, 'WEB', 'CONSENT', $2,
                  $3::timestamptz, $4::uuid, l.id, jsonb_build_object('listingId', l.public_id, 'source', 'SEARCH')
           FROM listings l WHERE l.public_id = $5
           ON CONFLICT DO NOTHING`,
          [
            deterministicEventId("test-aggregation", listingId, String(index)),
            policy,
            at,
            anonymousId,
            listingId,
          ],
        )
      }
    })

    const dailyRow = async () =>
      (
        await test.db.query<{ detail_views: number; unique_viewers: number }>(
          `SELECT detail_views, unique_viewers FROM analytics_listing_daily
           WHERE day = $1::date AND listing_id = (SELECT id FROM listings WHERE public_id = $2)`,
          [isoDay(day), listingId],
        )
      ).rows

    it("recalcule un jour de façon idempotente", async () => {
      const aggregation = test.app.get(AggregationService)
      expect(await aggregation.recomputeDay(day)).toBe(true)
      const first = await dailyRow()
      expect(first).toEqual([{ detail_views: 4, unique_viewers: 3 }])
      expect(await aggregation.recomputeDay(day)).toBe(true)
      expect(await dailyRow()).toEqual(first)
      const funnel = await test.db.query<{ value: string }>(
        "SELECT value FROM analytics_daily_metrics WHERE day = $1::date AND metric = 'funnel'",
        [isoDay(day)],
      )
      expect(funnel.rows.map((row) => row.value)).toEqual(
        expect.arrayContaining(["1_VISIT", "3_DETAIL"]),
      )
    })

    it("refuse de recalculer un jour déjà purgé", async () => {
      const aggregation = test.app.get(AggregationService)
      const tooOld = addDays(aggregation.oldestRecomputableDay(), -1)
      await expect(aggregation.recomputeDay(tooOld)).rejects.toThrow(
        /rétention/,
      )
    })

    it("la tâche périodique avance son checkpoint", async () => {
      const result = await test.app.get(AnalyticsWorker).runOnce()
      expect(result.aggregatedDays).toBeGreaterThan(0)
      const checkpoint = await test.db.query<{
        completed_day: string
        last_error: string | null
      }>(
        "SELECT completed_day::text, last_error FROM analytics_checkpoints WHERE job = 'aggregate_daily'",
      )
      expect(checkpoint.rows[0]!.last_error).toBeNull()
      expect(checkpoint.rows[0]!.completed_day).toBe(
        isoDay(addDays(utcDay(new Date()), -1)),
      )
    })
  })

  describe("lecture des statistiques", () => {
    const from = () => isoDay(addDays(utcDay(new Date()), -6))

    it("le propriétaire et l'agent mandaté voient les agrégats de l'annonce, sans visiteur", async () => {
      for (const user of [owner, agent]) {
        const response = await test.http
          .get(`/api/v1/analytics/listings/${listingId}`)
          .query({ from: from() })
          .set(user.auth)
          .expect(200)
        expect(response.body.listing.id).toBe(listingId)
        expect(response.body.totals.detailViews).toBeGreaterThanOrEqual(4)
        expect(response.body.rates).toHaveProperty("contactRate")
        const json = JSON.stringify(response.body)
        for (const viewer of [customer.userId])
          expect(json).not.toContain(viewer)
        expect(json).not.toMatch(/anonymous|userId|sessionId/i)
      }
    })

    it("404 pour un autre propriétaire, 403 sans permission, 401 anonyme", async () => {
      const other = await test.http
        .get(`/api/v1/analytics/listings/${listingId}`)
        .set(otherOwner.auth)
        .expect(404)
      expect(other.body.code).toBe("LISTING_NOT_FOUND")
      await test.http
        .get(`/api/v1/analytics/listings/${listingId}`)
        .set(customer.auth)
        .expect(403)
      await test.http.get(`/api/v1/analytics/listings/${listingId}`).expect(401)
      await test.http
        .get(`/api/v1/analytics/listings/${randomUUID()}`)
        .set(owner.auth)
        .expect(404)
    })

    it("liste les annonces gérées, et seulement elles", async () => {
      const mine = await test.http
        .get("/api/v1/analytics/me/listings")
        .query({ from: from() })
        .set(owner.auth)
        .expect(200)
      const ids = (mine.body.items as Array<{ listing: { id: string } }>).map(
        (item) => item.listing.id,
      )
      expect(ids).toContain(listingId)
      const others = await test.http
        .get("/api/v1/analytics/me/listings")
        .set(otherOwner.auth)
        .expect(200)
      expect(others.body.items).toEqual([])
    })

    it("valide la période", async () => {
      await test.http
        .get(`/api/v1/analytics/listings/${listingId}`)
        .query({ from: "2026-02-30" })
        .set(owner.auth)
        .expect(400)
      const tooLong = await test.http
        .get("/api/v1/admin/analytics/overview")
        .query({ from: "2020-01-01", to: "2026-01-01" })
        .set(admin.auth)
        .expect(400)
      expect(tooLong.body.code).toBe("ANALYTICS_RANGE_INVALID")
    })

    it("les vues d'administration sont réservées et fondées sur les agrégats", async () => {
      for (const path of [
        "overview",
        "funnel",
        "search",
        "recommendations",
        "quality",
      ]) {
        await test.http
          .get(`/api/v1/admin/analytics/${path}`)
          .set(owner.auth)
          .expect(403)
        const response = await test.http
          .get(`/api/v1/admin/analytics/${path}`)
          .query({ from: from() })
          .set(admin.auth)
          .expect(200)
        expect(response.body.range.from).toBe(from())
      }
      const funnel = await test.http
        .get("/api/v1/admin/analytics/funnel")
        .query({ from: from() })
        .set(admin.auth)
        .expect(200)
      expect(funnel.body.steps[0]).toMatchObject({ step: "1_VISIT" })
      expect(funnel.body.steps[0].actorDays).toBeGreaterThanOrEqual(3)
      const quality = await test.http
        .get("/api/v1/admin/analytics/quality")
        .set(admin.auth)
        .expect(200)
      expect(quality.body.aggregation.lastSuccessAt).not.toBeNull()
    })
  })

  describe("rétention", () => {
    it("purge les événements bruts au-delà de la rétention, pas les récents", async () => {
      const oldId = randomUUID()
      const recentId = randomUUID()
      const retention = test.app.get(AnalyticsConfig).retentionDays
      await test.db.query(
        `INSERT INTO analytics_events (event_id, name, schema_version, source, basis, occurred_at)
         VALUES ($1, 'registration_completed', 1, 'BACKEND', 'LEGITIMATE_INTEREST', now() - make_interval(days => $3)),
                ($2, 'registration_completed', 1, 'BACKEND', 'LEGITIMATE_INTEREST', now())`,
        [oldId, recentId, retention + 2],
      )
      const purged = await test.app.get(RetentionService).purge()
      expect(purged).toBeGreaterThanOrEqual(1)
      const left = await test.db.query<{ event_id: string }>(
        "SELECT event_id::text FROM analytics_events WHERE event_id = ANY($1::uuid[])",
        [[oldId, recentId]],
      )
      expect(left.rows.map((row) => row.event_id)).toEqual([recentId])
    })
  })
})
