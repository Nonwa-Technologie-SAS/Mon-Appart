import type {
  RecommendationItem,
  RecommendationPreferences,
  RecommendationResponse,
} from "@mon-appart/types"
import { performance } from "node:perf_hooks"

import { CatalogRepository } from "../../src/modules/property"
import { SearchIndexer } from "../../src/modules/search"
import {
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"

/**
 * La base de test garde les annonces des exécutions précédentes : chaque
 * exécution crée sa propre ville (codes uniques) et toutes les requêtes
 * personnalisées la filtrent, ce qui rend les classements déterministes.
 */
const MARK =
  `R${Date.now().toString(36)}${process.pid.toString(36)}`.toUpperCase()
const CITY = `CITY_${MARK}`
const COMMUNE_1 = `C1_${MARK}`
const COMMUNE_2 = `C2_${MARK}`
const N1A = `N1A_${MARK}`
const N1B = `N1B_${MARK}`
const N2A = `N2A_${MARK}`

type Owner = "A" | "B"

interface Fixture {
  key: string
  owner: Owner
  listingType: "RENT" | "SALE"
  price: { amount: number; period: string }
  propertyType: string
  commune: string
  neighborhood: string
  bedrooms?: number
  surface?: number
  amenities?: string[]
  state?: "PUBLISHED" | "DRAFT" | "PAUSED"
}

const FIXTURES: Fixture[] = [
  {
    key: "a1",
    owner: "A",
    listingType: "RENT",
    price: { amount: 200_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 2,
    surface: 70,
  },
  {
    key: "a2",
    owner: "A",
    listingType: "RENT",
    price: { amount: 240_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1B,
    bedrooms: 2,
    surface: 75,
  },
  {
    key: "a3",
    owner: "B",
    listingType: "RENT",
    price: { amount: 180_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_2,
    neighborhood: N2A,
    bedrooms: 3,
    surface: 90,
  },
  {
    key: "a4",
    owner: "B",
    listingType: "RENT",
    price: { amount: 255_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 2,
    surface: 72,
  },
  {
    key: "v1",
    owner: "B",
    listingType: "RENT",
    price: { amount: 600_000, period: "MONTH" },
    propertyType: "VILLA",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 4,
    surface: 250,
    amenities: ["PARKING", "GARDEN"],
  },
  {
    key: "s1",
    owner: "B",
    listingType: "SALE",
    price: { amount: 40_000_000, period: "TOTAL" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 2,
    surface: 70,
  },
  {
    key: "o1",
    owner: "A",
    listingType: "RENT",
    price: { amount: 300_000, period: "MONTH" },
    propertyType: "OFFICE",
    commune: COMMUNE_2,
    neighborhood: N2A,
    surface: 120,
  },
  {
    key: "draft",
    owner: "A",
    listingType: "RENT",
    price: { amount: 150_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 2,
    surface: 60,
    state: "DRAFT",
  },
  {
    key: "paused",
    owner: "B",
    listingType: "RENT",
    price: { amount: 160_000, period: "MONTH" },
    propertyType: "APARTMENT",
    commune: COMMUNE_1,
    neighborhood: N1A,
    bedrooms: 2,
    surface: 60,
    state: "PAUSED",
  },
]

const VISIBLE = ["a1", "a2", "a3", "a4", "v1", "s1", "o1"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("Recommendation : moteur de recommandation", () => {
  let test: IdentityTestApp
  let ownerA: TestUser
  let ownerB: TestUser
  const ids: Record<string, string> = {}
  const keyOf = new Map<string, string>()

  beforeAll(async () => {
    test = await createIdentityApp()
    await createReferenceArea(test)
    test.app.get(CatalogRepository).invalidate()

    ownerA = await userWithRoles(test, ["OWNER"])
    ownerB = await userWithRoles(test, ["OWNER"])
    const indexer = test.app.get(SearchIndexer)
    for (const fixture of FIXTURES) {
      const owner = fixture.owner === "A" ? ownerA : ownerB
      const property = await createProperty(test, owner, {
        propertyType: fixture.propertyType,
        commune: fixture.commune,
        neighborhood: fixture.neighborhood,
        title: `Logement ${fixture.key} ${MARK}`,
        description: `Fixture de recommandation ${MARK}.`,
        surface: fixture.surface,
        bedrooms: fixture.bedrooms,
        bathrooms: fixture.bedrooms === undefined ? undefined : 1,
        latitude: 5.36,
        longitude: -3.98,
        ...(fixture.amenities ? { amenities: fixture.amenities } : {}),
      })
      const listing = await createListing(
        test,
        owner,
        property,
        fixture.listingType,
        fixture.price,
      )
      if (fixture.state !== "DRAFT") {
        await test.http
          .post(`/api/v1/listings/${listing}/publish`)
          .set(owner.auth)
          .send({})
          .expect(200)
      }
      if (fixture.state === "PAUSED") {
        await test.http
          .post(`/api/v1/listings/${listing}/pause`)
          .set(owner.auth)
          .send({})
          .expect(200)
      }
      await indexer.syncListing(listing)
      ids[fixture.key] = listing
      keyOf.set(listing, fixture.key)
    }
  })

  afterAll(async () => {
    await test?.close()
  })

  async function recommend(
    params: Record<string, string> = {},
    user?: TestUser,
    status = 200,
  ): Promise<RecommendationResponse> {
    const request = test.http
      .get("/api/v1/recommendations")
      .query({ city: CITY, ...params })
    if (user) request.set(user.auth)
    return (await request.expect(status)).body as RecommendationResponse
  }

  const keys = (items: RecommendationItem[]) =>
    items.map((item) => keyOf.get(item.listing.listingId) ?? "?")

  async function setPreferences(
    user: TestUser,
    body: Record<string, unknown>,
    status = 200,
  ) {
    return test.http
      .put("/api/v1/recommendations/preferences")
      .set(user.auth)
      .send(body)
      .expect(status)
  }

  async function internalId(table: "users" | "properties", publicId: string) {
    const rows = await test.db.query<{ id: string }>(
      `SELECT id::text FROM ${table} WHERE public_id = $1`,
      [publicId],
    )
    return rows.rows[0]!.id
  }

  async function propertyOf(listing: string) {
    const rows = await test.db.query<{ property_id: string }>(
      "SELECT property_id::text FROM listings WHERE public_id = $1",
      [listing],
    )
    return rows.rows[0]!.property_id
  }

  describe("visiteur", () => {
    it("reçoit des recommandations génériques, visibles seulement, non persistées", async () => {
      const body = await recommend()
      expect(body.meta).toMatchObject({
        context: "PERSONALIZED",
        level: "GENERIC",
        algorithmVersion: "rules-v1",
        degraded: false,
      })
      expect(new Set(keys(body.items))).toEqual(new Set(VISIBLE))
      for (const item of body.items) {
        expect(item.id).toBeNull()
        expect(Number.isInteger(item.score)).toBe(true)
        expect(item.score).toBeGreaterThanOrEqual(0)
        expect(item.score).toBeLessThanOrEqual(100)
        for (const reason of item.reasons) {
          expect(reason.label.length).toBeGreaterThan(0)
        }
      }
    })

    it("n'expose ni identifiant interne ni détail du score", async () => {
      const body = await recommend()
      const json = JSON.stringify(body)
      expect(json).not.toMatch(/components|createdById|"userId"|"ownerId"/)
      // Aucun identifiant numérique (séquentiel) : uniquement des UUID publics.
      expect(json).not.toMatch(/"\w*[iI]d":\s*"?\d+"?[,}]/)
      for (const item of body.items) {
        expect(item.listing.listingId).toMatch(UUID)
        expect(item.listing.propertyId).toMatch(UUID)
      }
    })

    it("refuse le retour et les préférences sans authentification", async () => {
      await test.http
        .post(`/api/v1/recommendations/${crypto.randomUUID()}/feedback`)
        .send({ type: "CLICKED" })
        .expect(401)
      await test.http.get("/api/v1/recommendations/preferences").expect(401)
      await test.http
        .put("/api/v1/recommendations/preferences")
        .send({})
        .expect(401)
    })
  })

  describe("paramètres", () => {
    it.each([
      [{ limit: "0" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ limit: "51" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ limit: "abc" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ listingType: "SWAP" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ propertyType: "CASTLE" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ city: "ATLANTIS" }, "INVALID_RECOMMENDATION_QUERY"],
      [{ cursor: "%%%" }, "INVALID_CURSOR"],
    ])("%o → 400 %s", async (params, code) => {
      const response = await test.http
        .get("/api/v1/recommendations")
        .query({ city: CITY, ...params })
        .expect(400)
      expect(response.body.code).toBe(code)
    })

    it("applique les filtres stricts de la requête", async () => {
      const sale = await recommend({ listingType: "SALE" })
      expect(keys(sale.items)).toEqual(["s1"])
      const offices = await recommend({ propertyType: "office" })
      expect(keys(offices.items)).toEqual(["o1"])
    })

    it("pagine par curseur sans doublon et refuse un curseur réutilisé ailleurs", async () => {
      const seen: string[] = []
      let cursor: string | undefined
      let pages = 0
      do {
        const page = await recommend({
          limit: "3",
          ...(cursor ? { cursor } : {}),
        })
        seen.push(...keys(page.items))
        cursor = page.pagination.nextCursor ?? undefined
        pages += 1
      } while (cursor && pages < 10)
      expect(pages).toBe(3)
      expect(seen).toHaveLength(VISIBLE.length)
      expect(new Set(seen)).toEqual(new Set(VISIBLE))

      const first = await recommend({ limit: "3" })
      const reused = await test.http
        .get("/api/v1/recommendations")
        .query({
          city: CITY,
          listingType: "RENT",
          cursor: first.pagination.nextCursor,
        })
        .expect(400)
      expect(reused.body.code).toBe("INVALID_CURSOR")
    })
  })

  describe("préférences déclarées", () => {
    let user: TestUser

    beforeAll(async () => {
      user = await userWithRoles(test, ["CUSTOMER"])
    })

    it("valide les préférences avant de les enregistrer", async () => {
      const cases: Array<[Record<string, unknown>, string]> = [
        [{ maxBudget: 250_000 }, "BUDGET_PERIOD_REQUIRED"],
        [
          { listingTypes: ["RENT", "SALE"], maxBudget: 250_000 },
          "BUDGET_PERIOD_REQUIRED",
        ],
        [
          { listingTypes: ["RENT"], minBudget: 300_000, maxBudget: 200_000 },
          "INVALID_PREFERENCES",
        ],
        [{ budgetTolerancePct: 10 }, "INVALID_PREFERENCES"],
        [{ neighborhoods: ["NOWHERE"] }, "INVALID_PREFERENCES"],
        [{ propertyTypes: ["CASTLE"] }, "INVALID_PREFERENCES"],
        [{ latitude: 5.3 }, "INVALID_PREFERENCES"],
        [{ radiusKm: 3 }, "INVALID_PREFERENCES"],
      ]
      for (const [body, code] of cases) {
        const response = await setPreferences(user, body, 400)
        expect(response.body.code).toBe(code)
      }
      await setPreferences(user, { budgetTolerancePct: 50, maxBudget: 1 }, 400)
      await setPreferences(user, { unknown: true }, 400)
    })

    it("enregistre et relit les préférences telles que saisies", async () => {
      const saved = await setPreferences(user, {
        listingTypes: ["RENT"],
        maxBudget: 250_000,
        neighborhoods: [N1A],
        propertyTypes: ["APARTMENT"],
      })
      const read = await test.http
        .get("/api/v1/recommendations/preferences")
        .set(user.auth)
        .expect(200)
      const preferences = read.body as RecommendationPreferences
      expect(read.body).toEqual(saved.body)
      expect(preferences).toMatchObject({
        listingTypes: ["RENT"],
        budget: {
          min: null,
          max: 250_000,
          currency: "XOF",
          period: null,
          tolerancePct: 0,
        },
        neighborhoods: [N1A],
        propertyTypes: ["APARTMENT"],
      })
    })

    it("ne dépasse jamais le budget maximum sans tolérance", async () => {
      const body = await recommend({}, user)
      expect(body.meta.level).toBe("PREFERENCES")
      expect(new Set(keys(body.items))).toEqual(new Set(["a1", "a2", "a3"]))
      for (const item of body.items) {
        expect(item.listing.price!.amount).toBeLessThanOrEqual(250_000)
      }
      const [top] = body.items
      expect(keys([top!])).toEqual(["a1"])
      expect(top!.reasons.map((reason) => reason.code)).toEqual(
        expect.arrayContaining(["BUDGET_MATCH", "PREFERRED_NEIGHBORHOOD"]),
      )
    })

    it("persiste chaque recommandation servie avec un identifiant public", async () => {
      const body = await recommend({}, user)
      const userId = await internalId("users", user.userId)
      for (const [index, item] of body.items.entries()) {
        expect(item.id).toMatch(UUID)
        const rows = await test.db.query<{
          user_id: string
          context: string
          rank: number
          algorithm_version: string
        }>(
          `SELECT user_id::text, context::text, rank, algorithm_version
             FROM recommendations WHERE public_id = $1`,
          [item.id],
        )
        expect(rows.rows[0]).toEqual({
          user_id: userId,
          context: "PERSONALIZED",
          rank: index + 1,
          algorithm_version: "rules-v1",
        })
      }
      const again = await recommend({}, user)
      expect(again.items.map((item) => item.id)).toEqual(
        body.items.map((item) => item.id),
      )
    })

    it("n'accepte un dépassement que dans la tolérance déclarée", async () => {
      await setPreferences(user, {
        listingTypes: ["RENT"],
        maxBudget: 250_000,
        budgetTolerancePct: 10,
        neighborhoods: [N1A],
        propertyTypes: ["APARTMENT"],
      })
      const body = await recommend({}, user)
      expect(new Set(keys(body.items))).toEqual(
        new Set(["a1", "a2", "a3", "a4"]),
      )
      const a4 = body.items.find((item) => item.listing.listingId === ids.a4)!
      expect(a4.reasons.map((reason) => reason.code)).toContain(
        "BUDGET_WITHIN_TOLERANCE",
      )
      for (const item of body.items) {
        expect(item.listing.price!.amount).toBeLessThanOrEqual(275_000)
      }
    })

    it("n'applique pas un budget mensuel à une vente demandée explicitement", async () => {
      const body = await recommend({ listingType: "SALE" }, user)
      expect(keys(body.items)).toEqual(["s1"])
      expect(body.items[0]!.reasons.map((reason) => reason.code)).not.toContain(
        "BUDGET_MATCH",
      )
    })

    it("enregistre un retour une seule fois et écarte l'annonce rejetée", async () => {
      const body = await recommend({}, user)
      const a1 = body.items.find((item) => item.listing.listingId === ids.a1)!
      for (let i = 0; i < 2; i += 1) {
        await test.http
          .post(`/api/v1/recommendations/${a1.id}/feedback`)
          .set(user.auth)
          .send({ type: "NOT_INTERESTED" })
          .expect(204)
      }
      const rows = await test.db.query<{ count: string }>(
        `SELECT count(*)::text FROM recommendation_feedback rf
           JOIN recommendations r ON r.id = rf.recommendation_id
          WHERE r.public_id = $1`,
        [a1.id],
      )
      expect(rows.rows[0]!.count).toBe("1")

      const after = await recommend({}, user)
      expect(keys(after.items)).not.toContain("a1")
      const similar = await test.http
        .get(`/api/v1/recommendations/similar/${ids.a4}`)
        .set(user.auth)
        .expect(200)
      expect(keys(similar.body.items)).not.toContain("a1")
    })

    it("refuse un retour invalide ou sur la recommandation d'un autre", async () => {
      const body = await recommend({}, user)
      const id = body.items[0]!.id
      const other = await userWithRoles(test, ["CUSTOMER"])
      const foreign = await test.http
        .post(`/api/v1/recommendations/${id}/feedback`)
        .set(other.auth)
        .send({ type: "INTERESTED" })
        .expect(404)
      expect(foreign.body.code).toBe("RECOMMENDATION_NOT_FOUND")
      await test.http
        .post("/api/v1/recommendations/not-a-uuid/feedback")
        .set(user.auth)
        .send({ type: "CLICKED" })
        .expect(404)
      await test.http
        .post(`/api/v1/recommendations/${id}/feedback`)
        .set(user.auth)
        .send({ type: "LOVE" })
        .expect(400)
    })
  })

  describe("signaux de comportement", () => {
    it("s'appuie sur l'activité réelle et écarte les favoris", async () => {
      const user = await userWithRoles(test, ["CUSTOMER"])
      const userId = await internalId("users", user.userId)
      const viewed = await propertyOf(ids.a3!)
      const favorite = await propertyOf(ids.o1!)
      for (const minutesAgo of [5, 60, 600]) {
        await test.db.query(
          `INSERT INTO property_views (user_id, property_id, source, duration_ms, created_at)
           VALUES ($1, $2, 'SEARCH', 60000, now() - make_interval(mins => $3))`,
          [userId, viewed, minutesAgo],
        )
      }
      await test.db.query(
        "INSERT INTO favorites (user_id, property_id) VALUES ($1, $2)",
        [userId, favorite],
      )

      const body = await recommend({}, user)
      expect(body.meta.level).toBe("BEHAVIOR")
      expect(keys(body.items)).not.toContain("o1")
      expect(keys(body.items)[0]).toBe("a3")
      expect(body.items[0]!.reasons.map((reason) => reason.code)).toContain(
        "MATCHES_YOUR_ACTIVITY",
      )
      const profile = await test.db.query<{ model_version: string }>(
        "SELECT model_version FROM user_behavior_profiles WHERE user_id = $1",
        [userId],
      )
      expect(profile.rows[0]?.model_version).toBe("behavior-v1")
    })

    it("ne propose jamais ses propres annonces à un propriétaire", async () => {
      const body = await recommend({}, ownerA)
      expect(keys(body.items).sort()).toEqual(["a3", "a4", "s1", "v1"])
    })
  })

  describe("annonces similaires", () => {
    it("reste dans la même offre, catégorie et ville, sans la référence", async () => {
      const response = await test.http
        .get(`/api/v1/recommendations/similar/${ids.a1}`)
        .expect(200)
      const body = response.body as RecommendationResponse
      expect(body.meta).toMatchObject({ context: "SIMILAR", level: "GENERIC" })
      expect(new Set(keys(body.items))).toEqual(
        new Set(["a2", "a3", "a4", "v1"]),
      )
      // La villa, hors fourchette de prix, n'entre que par élargissement.
      const villa = body.items.find(
        (item) => item.listing.listingId === ids.v1,
      )!
      for (const item of body.items) {
        expect(villa.score).toBeLessThanOrEqual(item.score)
      }
      const a4 = body.items.find((item) => item.listing.listingId === ids.a4)!
      expect(a4.reasons.map((reason) => reason.code)).toEqual(
        expect.arrayContaining(["SAME_NEIGHBORHOOD"]),
      )
      for (const item of body.items) expect(item.id).toBeNull()
    })

    it("persiste les similaires servis à un compte", async () => {
      const user = await userWithRoles(test, ["CUSTOMER"])
      const response = await test.http
        .get(`/api/v1/recommendations/similar/${ids.a1}`)
        .set(user.auth)
        .expect(200)
      for (const item of (response.body as RecommendationResponse).items) {
        expect(item.id).toMatch(UUID)
        expect(item.context).toBe("SIMILAR")
      }
    })

    it.each([
      ["inconnue", () => crypto.randomUUID()],
      ["non publiée", () => ids.draft!],
      ["en pause", () => ids.paused!],
      ["identifiant invalide", () => "123"],
    ])("404 pour une annonce %s", async (_label, id) => {
      const response = await test.http
        .get(`/api/v1/recommendations/similar/${id()}`)
        .expect(404)
      expect(response.body.code).toBe("LISTING_NOT_FOUND")
    })
  })

  describe("performance (indicative)", () => {
    it("répond vite sur tout le catalogue de test, sans filtre de ville", async () => {
      const user = await userWithRoles(test, ["CUSTOMER"])
      await test.http.get("/api/v1/recommendations").set(user.auth).expect(200)
      const durations: number[] = []
      for (let i = 0; i < 5; i += 1) {
        const started = performance.now()
        await test.http
          .get("/api/v1/recommendations")
          .query({ limit: "50" })
          .set(user.auth)
          .expect(200)
        durations.push(performance.now() - started)
      }
      durations.sort((a, b) => a - b)
      expect(durations[2]).toBeLessThan(1_500)
    })
  })
})

/** Ville, communes et quartiers propres à l'exécution (base *_test uniquement). */
async function createReferenceArea(test: IdentityTestApp): Promise<void> {
  const city = await test.db.query<{ id: number }>(
    `INSERT INTO cities (district_id, code, name)
     SELECT id, $1, $2 FROM districts ORDER BY id LIMIT 1
     RETURNING id`,
    [CITY, `Ville test ${MARK}`],
  )
  const cityId = city.rows[0]!.id
  const communes: Record<string, number> = {}
  for (const code of [COMMUNE_1, COMMUNE_2]) {
    const commune = await test.db.query<{ id: number }>(
      "INSERT INTO communes (city_id, code, name) VALUES ($1, $2, $3) RETURNING id",
      [cityId, code, `Commune ${code}`],
    )
    communes[code] = commune.rows[0]!.id
  }
  for (const [commune, code] of [
    [COMMUNE_1, N1A],
    [COMMUNE_1, N1B],
    [COMMUNE_2, N2A],
  ] as const) {
    await test.db.query(
      "INSERT INTO neighborhoods (commune_id, code, name) VALUES ($1, $2, $3)",
      [communes[commune], code, `Quartier ${code}`],
    )
  }
}
