import { EventEmitter2 } from "@nestjs/event-emitter"

import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"
import {
  assign,
  auditActions,
  createListing,
  createProperty,
  LAND_BINGERVILLE,
  userWithRoles,
  VILLA_COCODY,
  type TestUser,
} from "./catalog-app"

const VILLA_PRICE = { amount: 1_500_000, period: "MONTH" }
const LAND_PRICE = { amount: 50_000_000, period: "TOTAL" }

interface PriceRow {
  amount: string
  valid_from: Date
  valid_to: Date | null
}

describe("Listing : annonces", () => {
  let test: IdentityTestApp
  let owner: TestUser
  let otherOwner: TestUser
  let customer: TestUser
  let agent: TestUser
  let moderator: TestUser
  let admin: TestUser

  beforeAll(async () => {
    test = await createIdentityApp()
    owner = await userWithRoles(test, ["OWNER"])
    otherOwner = await userWithRoles(test, ["OWNER"])
    customer = await userWithRoles(test, [])
    agent = await userWithRoles(test, ["AGENT"])
    moderator = await userWithRoles(test, ["MODERATOR"])
    admin = await userWithRoles(test, ["ADMIN"])
  })

  afterAll(async () => {
    await test.close()
  })

  async function prices(listingId: string): Promise<PriceRow[]> {
    const rows = await test.db.query<PriceRow>(
      `SELECT lp.amount::text AS amount, lp.valid_from, lp.valid_to
         FROM listing_prices lp JOIN listings l ON l.id = lp.listing_id
        WHERE l.public_id = $1 ORDER BY lp.valid_from, lp.id`,
      [listingId],
    )
    return rows.rows
  }

  function publish(user: TestUser, listingId: string) {
    return test.http
      .post(`/api/v1/listings/${listingId}/publish`)
      .set(user.auth)
      .send({})
  }

  function setStatus(user: TestUser, listingId: string, status: string) {
    return test.http
      .post(`/api/v1/listings/${listingId}/status`)
      .set(user.auth)
      .send({ status })
  }

  describe("création et autorisations", () => {
    it("CUSTOMER ne crée pas d'annonce sur le bien d'un autre", async () => {
      const property = await createProperty(test, owner)
      const response = await test.http
        .post("/api/v1/listings")
        .set(customer.auth)
        .send({ propertyId: property, listingType: "RENT", price: VILLA_PRICE })
        .expect(403)
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSION")
    })

    it("OWNER crée une annonce sur son bien, pas sur celui d'un autre", async () => {
      const property = await createProperty(test, owner)
      const created = await test.http
        .post("/api/v1/listings")
        .set(owner.auth)
        .send({ propertyId: property, listingType: "RENT", price: VILLA_PRICE })
        .expect(201)
      expect(created.body).toMatchObject({
        status: "DRAFT",
        title: VILLA_COCODY.title,
        price: { amount: "1500000", currency: "XOF", period: "MONTH" },
        property: { id: property },
        relation: "SOLE",
      })
      const refused = await test.http
        .post("/api/v1/listings")
        .set(otherOwner.auth)
        .send({ propertyId: property, listingType: "SALE" })
        .expect(403)
      expect(refused.body.code).toBe("PROPERTY_ACCESS_DENIED")
    })

    it("refuse les champs sensibles fournis par le client", async () => {
      const property = await createProperty(test, owner)
      await test.http
        .post("/api/v1/listings")
        .set(owner.auth)
        .send({
          propertyId: property,
          listingType: "RENT",
          createdById: otherOwner.userId,
        })
        .expect(400)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      await test.http
        .patch(`/api/v1/listings/${listing}`)
        .set(owner.auth)
        .send({ status: "PUBLISHED" })
        .expect(400)
    })

    it("AGENT assigné gère l'annonce ; ADMIN aussi, avec dérogation tracée", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const denied = await publish(agent, listing).expect(404)
      expect(denied.body.code).toBe("LISTING_NOT_FOUND")

      await assign(test, property, agent.userId, "AGENT")
      await publish(agent, listing).expect(200)

      await test.http
        .post(`/api/v1/listings/${listing}/pause`)
        .set(admin.auth)
        .send({ reason: "Contrôle qualité" })
        .expect(200)
      const paused = (await auditActions(test, listing)).find(
        (row) => row.action === "LISTING_PAUSED",
      )
      expect(paused?.new_values).toMatchObject({
        adminOverride: true,
        reason: "Contrôle qualité",
      })
    })
  })

  describe("cycle de vie", () => {
    it("Villa Cocody RENT 1 500 000 XOF : DRAFT → PUBLISHED → PAUSED → PUBLISHED → RENTED", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )

      const sold = await setStatus(owner, listing, "SOLD").expect(409)
      expect(sold.body.code).toBe("INVALID_LISTING_STATUS_TRANSITION")

      const published = await publish(owner, listing).expect(200)
      expect(published.body.status).toBe("PUBLISHED")
      expect(published.body.publishedAt).toEqual(expect.any(String))
      expect(published.body.expiresAt).toEqual(expect.any(String))
      const again = await publish(owner, listing).expect(409)
      expect(again.body.code).toBe("LISTING_ALREADY_PUBLISHED")

      await test.http
        .post(`/api/v1/listings/${listing}/pause`)
        .set(owner.auth)
        .send({})
        .expect(200)
      const anonymousPaused = await test.http
        .get(`/api/v1/listings/${listing}`)
        .expect(404)
      expect(anonymousPaused.body.code).toBe("LISTING_NOT_FOUND")

      const resumed = await publish(owner, listing).expect(200)
      expect(resumed.body.publishedAt).toBe(published.body.publishedAt)

      const wrongOutcome = await setStatus(owner, listing, "SOLD").expect(409)
      expect(wrongOutcome.body.code).toBe("INVALID_LISTING_STATUS_TRANSITION")
      await setStatus(owner, listing, "RENTED").expect(200)
      const closed = await publish(owner, listing).expect(409)
      expect(closed.body.code).toBe("LISTING_ALREADY_SOLD")

      const history = await test.http
        .get(`/api/v1/listings/${listing}/history`)
        .set(owner.auth)
        .expect(200)
      expect(
        history.body.statuses.map(
          (entry: { newStatus: string }) => entry.newStatus,
        ),
      ).toEqual(["DRAFT", "PUBLISHED", "PAUSED", "PUBLISHED", "RENTED"])
      expect(history.body.statuses[0].changedBy).toBe(owner.userId)
    })

    it("Terrain Bingerville SALE 50 000 000 XOF : PUBLISHED → SOLD", async () => {
      const property = await createProperty(test, owner, LAND_BINGERVILLE)
      const listing = await createListing(
        test,
        owner,
        property,
        "SALE",
        LAND_PRICE,
      )
      await publish(owner, listing).expect(200)
      const sold = await setStatus(owner, listing, "SOLD").expect(200)
      expect(sold.body.status).toBe("SOLD")
      const priceEdit = await test.http
        .put(`/api/v1/listings/${listing}/price`)
        .set(owner.auth)
        .send({ amount: 45_000_000, period: "TOTAL" })
        .expect(409)
      expect(priceEdit.body.code).toBe("LISTING_NOT_EDITABLE")
    })

    it("vérifie la complétude avant publication", async () => {
      const draftProperty = await createProperty(
        test,
        owner,
        VILLA_COCODY,
        false,
      )
      const onDraft = await createListing(
        test,
        owner,
        draftProperty,
        "RENT",
        VILLA_PRICE,
      )
      const inactive = await publish(owner, onDraft).expect(422)
      expect(inactive.body.code).toBe("PROPERTY_NOT_ACTIVE")

      const property = await createProperty(test, owner)
      const noPrice = await createListing(test, owner, property, "RENT")
      const missing = await publish(owner, noPrice).expect(422)
      expect(missing.body.code).toBe("NO_ACTIVE_PRICE")
    })

    it("une seule annonce en cours par bien et par type", async () => {
      const property = await createProperty(test, owner)
      const first = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const second = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      await publish(owner, first).expect(200)
      const conflict = await publish(owner, second).expect(409)
      expect(conflict.body.code).toBe("LISTING_ALREADY_LIVE_FOR_TYPE")
      // Une vente du même bien reste possible.
      const sale = await createListing(
        test,
        owner,
        property,
        "SALE",
        LAND_PRICE,
      )
      await publish(owner, sale).expect(200)
    })

    it("réserve la suspension et la validation à la modération", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      await publish(owner, listing).expect(200)

      const ownerSuspend = await setStatus(owner, listing, "SUSPENDED").expect(
        403,
      )
      expect(ownerSuspend.body.code).toBe("LISTING_ACCESS_DENIED")
      await setStatus(moderator, listing, "SUSPENDED").expect(200)
      const ownerResume = await publish(owner, listing).expect(403)
      expect(ownerResume.body.code).toBe("LISTING_ACCESS_DENIED")
      // Un modérateur ne vend pas le bien à la place du propriétaire.
      await setStatus(moderator, listing, "PUBLISHED").expect(200)
      const moderatorPause = await test.http
        .post(`/api/v1/listings/${listing}/pause`)
        .set(moderator.auth)
        .send({})
        .expect(403)
      expect(moderatorPause.body.code).toBe("LISTING_ACCESS_DENIED")
    })

    it("supprime logiquement en archivant, historique conservé", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      await publish(owner, listing).expect(200)
      await test.http
        .delete(`/api/v1/listings/${listing}`)
        .set(owner.auth)
        .expect(204)
      await test.http
        .get(`/api/v1/listings/${listing}`)
        .set(owner.auth)
        .expect(404)

      const row = await test.db.query<{
        status: string
        deleted_at: Date | null
        history: string
      }>(
        `SELECT l.status, l.deleted_at,
                (SELECT count(*) FROM listing_status_history h WHERE h.listing_id = l.id)::text AS history
           FROM listings l WHERE l.public_id = $1`,
        [listing],
      )
      expect(row.rows[0]).toMatchObject({ status: "ARCHIVED", history: "3" })
      expect(row.rows[0]?.deleted_at).toBeInstanceOf(Date)
      expect((await auditActions(test, listing)).at(-1)?.action).toBe(
        "LISTING_DELETED",
      )
    })
  })

  describe("historique des prix", () => {
    it("clôture l'ancien prix sans l'écraser", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const changed = await test.http
        .put(`/api/v1/listings/${listing}/price`)
        .set(owner.auth)
        .send({ amount: 1_400_000, period: "MONTH", reason: "Négociation" })
        .expect(200)
      expect(changed.body.price).toMatchObject({
        amount: "1400000",
        period: "MONTH",
      })

      // Même prix : aucune nouvelle ligne.
      await test.http
        .put(`/api/v1/listings/${listing}/price`)
        .set(owner.auth)
        .send({ amount: 1_400_000, period: "MONTH" })
        .expect(200)

      const rows = await prices(listing)
      expect(rows.map((row) => row.amount)).toEqual([
        "1500000.00",
        "1400000.00",
      ])
      expect(rows.filter((row) => row.valid_to === null)).toHaveLength(1)
      expect(rows[0]?.valid_to?.getTime()).toBe(rows[1]?.valid_from.getTime())

      const audit = (await auditActions(test, listing)).find(
        (r) => r.action === "PRICE_CHANGED",
      )
      expect(audit?.new_values).toMatchObject({
        amount: "1400000",
        reason: "Négociation",
      })
    })

    it.each([
      [{ amount: 0, period: "MONTH" }, 400],
      [{ amount: 1000.5, period: "MONTH" }, 400],
      [{ amount: 1000, period: "MONTH", currency: "EUR" }, 400],
      [{ amount: 1000, period: "TOTAL" }, 422],
    ])("refuse un prix invalide (%o)", async (price, status) => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const response = await test.http
        .put(`/api/v1/listings/${listing}/price`)
        .set(owner.auth)
        .send(price)
        .expect(status)
      if (status === 422) expect(response.body.code).toBe("INVALID_PRICE")
    })

    it("sérialise les changements concurrents : un seul prix courant, historique continu", async () => {
      const property = await createProperty(test, owner)
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        VILLA_PRICE,
      )
      const amounts = [1_100_000, 1_200_000, 1_300_000, 1_400_000, 1_600_000]
      const responses = await Promise.all(
        amounts.map((amount) =>
          test.http
            .put(`/api/v1/listings/${listing}/price`)
            .set(owner.auth)
            .send({ amount, period: "MONTH" }),
        ),
      )
      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200,
      ])

      const rows = await prices(listing)
      expect(rows).toHaveLength(amounts.length + 1)
      expect(rows.filter((row) => row.valid_to === null)).toHaveLength(1)
      for (let index = 0; index < rows.length - 1; index += 1) {
        const current = rows[index]!
        const next = rows[index + 1]!
        expect(current.valid_to!.getTime()).toBeGreaterThan(
          current.valid_from.getTime(),
        )
        expect(current.valid_to!.getTime()).toBe(next.valid_from.getTime())
      }
    })
  })

  describe("lecture publique et recherche", () => {
    let villaListing: string
    let landListing: string

    beforeAll(async () => {
      const villa = await createProperty(test, otherOwner)
      const land = await createProperty(test, otherOwner, LAND_BINGERVILLE)
      villaListing = await createListing(
        test,
        otherOwner,
        villa,
        "RENT",
        VILLA_PRICE,
      )
      landListing = await createListing(
        test,
        otherOwner,
        land,
        "SALE",
        LAND_PRICE,
      )
      await publish(otherOwner, villaListing).expect(200)
      await publish(otherOwner, landListing).expect(200)
    })

    it("fiche publique : bien, prix courant, localisation approximative, équipements", async () => {
      const response = await test.http
        .get(`/api/v1/listings/${villaListing}`)
        .expect(200)
      expect(response.body).toMatchObject({
        status: "PUBLISHED",
        listingType: "RENT",
        price: { amount: "1500000", currency: "XOF", period: "MONTH" },
        property: {
          propertyType: { code: "VILLA" },
          bedrooms: 4,
          surface: "280",
        },
        location: {
          precision: "APPROXIMATE",
          address: null,
          commune: { code: "COCODY" },
        },
        media: { count: 0, coverUrl: null },
      })
      expect(response.body.relation).toBeUndefined()
      expect(response.body.property.amenities).toHaveLength(3)
    })

    it("filtre par type d'offre, prix et commune", async () => {
      const rent = await test.http
        .get("/api/v1/listings")
        .query({
          listingType: "RENT",
          commune: "COCODY",
          minPrice: 1_000_000,
          maxPrice: 2_000_000,
          limit: 100,
        })
        .expect(200)
      const rentIds = rent.body.items.map((item: { id: string }) => item.id)
      expect(rentIds).toContain(villaListing)
      expect(rentIds).not.toContain(landListing)

      const sale = await test.http
        .get("/api/v1/listings")
        .query({
          listingType: "SALE",
          propertyType: "LAND",
          maxPrice: 60_000_000,
          limit: 100,
        })
        .expect(200)
      expect(sale.body.items.map((item: { id: string }) => item.id)).toContain(
        landListing,
      )

      const tooCheap = await test.http
        .get("/api/v1/listings")
        .query({ listingType: "RENT", maxPrice: 1_000_000, limit: 100 })
        .expect(200)
      expect(
        tooCheap.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(villaListing)
    })

    it("recherche dans un rayon de 5 km (PostGIS)", async () => {
      const response = await test.http
        .get("/api/v1/listings")
        .query({ latitude: 5.36, longitude: -3.96, radiusKm: 5, limit: 100 })
        .expect(200)
      const ids = response.body.items.map((item: { id: string }) => item.id)
      expect(ids).toContain(villaListing)
      expect(ids).not.toContain(landListing)
    })

    it("scope=mine expose le statut ; le public ne voit que les annonces publiées", async () => {
      const mine = await test.http
        .get("/api/v1/listings")
        .query({ scope: "mine", limit: 100 })
        .set(otherOwner.auth)
        .expect(200)
      expect(mine.body.items[0].status).toEqual(expect.any(String))
      const publicFeed = await test.http
        .get("/api/v1/listings")
        .query({ limit: 100 })
        .expect(200)
      for (const item of publicFeed.body.items)
        expect(item.status).toBeUndefined()
    })

    it("réserve scope=mine aux comptes connectés et scope=all à l'administration", async () => {
      await test.http
        .get("/api/v1/listings")
        .query({ scope: "mine" })
        .expect(401)
      const owner = await test.http
        .get("/api/v1/listings")
        .query({ scope: "all" })
        .set(otherOwner.auth)
        .expect(403)
      expect(owner.body.code).toBe("LISTING_ACCESS_DENIED")
      await test.http
        .get("/api/v1/listings")
        .query({ scope: "all" })
        .set(moderator.auth)
        .expect(200)
    })

    it("refuse l'historique à un tiers", async () => {
      const response = await test.http
        .get(`/api/v1/listings/${villaListing}/history`)
        .set(customer.auth)
        .expect(403)
      expect(response.body.code).toBe("LISTING_ACCESS_DENIED")
    })
  })

  describe("événements", () => {
    it("publie listing.published et listing.price_changed avec des identifiants publics", async () => {
      const events = test.app.get(EventEmitter2)
      const received: Array<{
        name: string
        payload: Record<string, unknown>
      }> = []
      const listener = (event: {
        name: string
        payload: Record<string, unknown>
      }) => {
        received.push(event)
      }
      events.on("listing.published", listener)
      events.on("listing.price_changed", listener)
      try {
        const property = await createProperty(test, owner)
        const listing = await createListing(
          test,
          owner,
          property,
          "RENT",
          VILLA_PRICE,
        )
        await publish(owner, listing).expect(200)
        await test.http
          .put(`/api/v1/listings/${listing}/price`)
          .set(owner.auth)
          .send({ amount: 1_450_000, period: "MONTH" })
          .expect(200)
        expect(received.map((event) => event.name)).toEqual([
          "listing.published",
          "listing.price_changed",
        ])
        expect(received[0]?.payload).toEqual({
          listingId: listing,
          propertyId: property,
          from: "DRAFT",
          to: "PUBLISHED",
        })
        expect(received[1]?.payload).toMatchObject({
          oldAmount: "1500000",
          newAmount: "1450000",
        })
      } finally {
        events.off("listing.published", listener)
        events.off("listing.price_changed", listener)
      }
    })
  })
})
