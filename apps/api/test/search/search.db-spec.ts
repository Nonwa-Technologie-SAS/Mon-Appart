import type { SearchResponse, SearchResultItem } from "@mon-appart/types"
import { performance } from "node:perf_hooks"

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
 * La base de test garde les données des exécutions précédentes : chaque
 * fixture porte un marqueur propre à l'exécution, et les assertions de
 * pertinence portent sur la nature des résultats, pas sur un nombre global.
 */
const MARK = `lot${Date.now().toString(36)}${process.pid.toString(36)}`

interface Fixture {
  key: string
  listingType: "RENT" | "SALE"
  price: { amount: number; period: string }
  property: Record<string, unknown>
}

const FIXTURES: Fixture[] = [
  {
    key: "villaCocody",
    listingType: "RENT",
    price: { amount: 1_500_000, period: "MONTH" },
    property: {
      propertyType: "VILLA",
      commune: "COCODY",
      neighborhood: "RIVIERA",
      title: "Villa 4 chambres Cocody Riviera",
      description: `Villa avec jardin et piscine, proche des commodités. ${MARK}`,
      surface: 280,
      bedrooms: 4,
      bathrooms: 3,
      address: "Riviera 3, rue des Jardins",
      latitude: 5.3625,
      longitude: -3.9612,
      amenities: ["PARKING", "SECURITY", "GARDEN"],
    },
  },
  {
    key: "appartCocody",
    listingType: "RENT",
    price: { amount: 450_000, period: "MONTH" },
    property: {
      propertyType: "APARTMENT",
      commune: "COCODY",
      neighborhood: "ANGRE",
      title: "Appartement 3 pièces Angré",
      description: `Appartement lumineux au 2e étage avec ascenseur. ${MARK}`,
      surface: 95,
      bedrooms: 2,
      bathrooms: 2,
      latitude: 5.3971,
      longitude: -3.9905,
      amenities: ["PARKING", "ELEVATOR"],
    },
  },
  {
    key: "maisonYopougon",
    listingType: "SALE",
    price: { amount: 35_000_000, period: "TOTAL" },
    property: {
      propertyType: "HOUSE",
      commune: "YOPOUGON",
      neighborhood: "NIANGON",
      title: "Maison familiale Niangon",
      description: `Maison avec cour, quartier calme. ${MARK}`,
      surface: 160,
      bedrooms: 3,
      bathrooms: 2,
      latitude: 5.3247,
      longitude: -4.0846,
      amenities: ["SECURITY"],
    },
  },
  {
    key: "terrainBingerville",
    listingType: "SALE",
    price: { amount: 50_000_000, period: "TOTAL" },
    property: {
      propertyType: "LAND",
      commune: "BINGERVILLE",
      neighborhood: "FEH_KESSE",
      title: "Terrain 600 m² Bingerville",
      description: `Terrain viabilisé avec ACD. ${MARK}`,
      landSurface: 600,
      latitude: 5.3558,
      longitude: -3.8854,
    },
  },
  {
    key: "appartMarcory",
    listingType: "RENT",
    price: { amount: 300_000, period: "MONTH" },
    property: {
      propertyType: "APARTMENT",
      commune: "MARCORY",
      neighborhood: "ZONE_4",
      title: "Appartement 2 chambres Zone 4",
      description: `Appartement meublé avec climatisation. ${MARK}`,
      surface: 80,
      bedrooms: 2,
      bathrooms: 1,
      latitude: 5.2969,
      longitude: -3.9822,
      amenities: ["AIR_CONDITIONING", "FURNISHED"],
    },
  },
  {
    key: "bureauPlateau",
    listingType: "RENT",
    price: { amount: 800_000, period: "MONTH" },
    property: {
      propertyType: "OFFICE",
      commune: "PLATEAU",
      neighborhood: "CENTRE_AFFAIRES",
      title: "Bureau 120 m² Plateau",
      description: `Plateau de bureaux climatisé, parking. ${MARK}`,
      surface: 120,
      latitude: 5.3197,
      longitude: -4.0168,
      amenities: ["PARKING", "AIR_CONDITIONING"],
    },
  },
  {
    key: "commerceTreichville",
    listingType: "RENT",
    price: { amount: 600_000, period: "MONTH" },
    property: {
      propertyType: "SHOP",
      commune: "TREICHVILLE",
      neighborhood: "ARRAS",
      title: "Local commercial Treichville",
      description: `Boutique sur rue passante. ${MARK}`,
      surface: 60,
      latitude: 5.2933,
      longitude: -4.0089,
    },
  },
]

describe("Search : recherche publique", () => {
  let test: IdentityTestApp
  let owner: TestUser
  let indexer: SearchIndexer
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    test = await createIdentityApp()
    owner = await userWithRoles(test, ["OWNER"])
    indexer = test.app.get(SearchIndexer)
    for (const fixture of FIXTURES) {
      const property = await createProperty(test, owner, fixture.property)
      const listing = await createListing(
        test,
        owner,
        property,
        fixture.listingType,
        fixture.price,
      )
      await test.http
        .post(`/api/v1/listings/${listing}/publish`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await indexer.syncListing(listing)
      ids[fixture.key] = listing
    }
  })

  afterAll(async () => {
    await test.close()
  })

  async function search(
    params: Record<string, string>,
    status = 200,
  ): Promise<SearchResponse> {
    const response = await test.http
      .get("/api/v1/search")
      .query(params)
      .expect(status)
    return response.body as SearchResponse
  }

  const listingIds = (items: SearchResultItem[]) =>
    items.map((item) => item.listingId)

  describe("pertinence", () => {
    it.each([
      ["villa cocody", "VILLA", "COCODY", "villaCocody"],
      ["terrain bingerville", "LAND", "BINGERVILLE", "terrainBingerville"],
      ["appartement marcory", "APARTMENT", "MARCORY", "appartMarcory"],
      ["maison yopougon", "HOUSE", "YOPOUGON", "maisonYopougon"],
      ["bureau plateau", "OFFICE", "PLATEAU", "bureauPlateau"],
    ])("« %s » ne renvoie que des %s à %s", async (q, type, commune, key) => {
      const body = await search({ q, limit: "50" })
      expect(body.meta).toMatchObject({
        sort: "RELEVANCE",
        engine: "postgres",
        fuzzy: false,
      })
      expect(body.items.length).toBeGreaterThan(0)
      for (const item of body.items.slice(0, 10)) {
        expect(item.propertyType.code).toBe(type)
        expect(item.location.commune.code).toBe(commune)
        expect(item.score).toBeGreaterThan(0)
        expect(item.score).toBeLessThanOrEqual(1)
      }
      const exact = await search({ q: `${q} ${MARK}` })
      expect(listingIds(exact.items)).toEqual([ids[key]])
    })

    it("ignore accents, casse et espaces", async () => {
      const plain = await search({ q: `terrain feh kesse ${MARK}` })
      const accented = await search({ q: `  TERRAIN   Féh  Kessé ${MARK} ` })
      expect(listingIds(plain.items)).toEqual([ids.terrainBingerville])
      expect(listingIds(accented.items)).toEqual(listingIds(plain.items))
    })

    it("tolère une faute de frappe quand le plein texte strict ne trouve rien", async () => {
      const body = await search({ q: "apartement marcori" })
      expect(body.meta.fuzzy).toBe(true)
      expect(body.items[0]?.propertyType.code).toBe("APARTMENT")
      expect(body.items[0]?.location.commune.code).toBe("MARCORY")
    })

    it("cherche aussi dans les descriptions (poids moyen)", async () => {
      const body = await search({ q: `piscine ${MARK}` })
      expect(listingIds(body.items)).toEqual([ids.villaCocody])
    })
  })

  describe("filtres", () => {
    it("filtre par codes de lieu, insensibles à la casse et aux accents", async () => {
      const cocody = await search({ q: MARK, commune: "cocody" })
      expect(new Set(listingIds(cocody.items))).toEqual(
        new Set([ids.villaCocody, ids.appartCocody]),
      )
      const neighborhood = await search({ q: MARK, neighborhood: "Féh-Kessé" })
      expect(listingIds(neighborhood.items)).toEqual([ids.terrainBingerville])
      const city = await search({ q: MARK, city: "ABIDJAN" })
      expect(city.items.length).toBe(FIXTURES.length)
    })

    it("filtre sur le prix courant, le type d'annonce et le type de bien", async () => {
      const rent = await search({
        q: MARK,
        listingType: "RENT",
        minPrice: "400000",
        maxPrice: "900000",
      })
      expect(new Set(listingIds(rent.items))).toEqual(
        new Set([ids.appartCocody, ids.bureauPlateau, ids.commerceTreichville]),
      )
      const types = await search({ q: MARK, propertyType: "APARTMENT,HOUSE" })
      expect(new Set(listingIds(types.items))).toEqual(
        new Set([ids.appartCocody, ids.appartMarcory, ids.maisonYopougon]),
      )
    })

    it("filtre sur surface, surface de terrain et pièces (≥ N)", async () => {
      const surface = await search({ q: MARK, minSurface: "150" })
      expect(new Set(listingIds(surface.items))).toEqual(
        new Set([ids.villaCocody, ids.maisonYopougon, ids.terrainBingerville]),
      )
      const land = await search({ q: MARK, minLandSurface: "500" })
      expect(listingIds(land.items)).toEqual([ids.terrainBingerville])
      const bedrooms = await search({ q: MARK, bedrooms: "3" })
      expect(new Set(listingIds(bedrooms.items))).toEqual(
        new Set([ids.villaCocody, ids.maisonYopougon]),
      )
    })

    it("équipements : ET par défaut, OU sur demande", async () => {
      const all = await search({
        q: MARK,
        amenities: "PARKING,AIR_CONDITIONING",
      })
      expect(listingIds(all.items)).toEqual([ids.bureauPlateau])
      const any = await search({
        q: MARK,
        amenities: "GARDEN,FURNISHED",
        amenitiesMode: "OR",
      })
      expect(new Set(listingIds(any.items))).toEqual(
        new Set([ids.villaCocody, ids.appartMarcory]),
      )
    })

    it("rayon PostGIS avec distance en km, tri par distance", async () => {
      const body = await search({
        q: MARK,
        lat: "5.3600",
        lng: "-3.9600",
        radius: "5",
        sort: "DISTANCE",
      })
      expect(listingIds(body.items)[0]).toBe(ids.villaCocody)
      expect(listingIds(body.items)).not.toContain(ids.maisonYopougon)
      const distances = body.items.map((item) => item.distance!.value)
      expect(distances).toEqual([...distances].sort((a, b) => a - b))
      expect(body.items[0]!.distance).toMatchObject({ unit: "km" })
      expect(body.items[0]!.distance!.value).toBeLessThan(2)
    })

    it("n'expose que la position publiée, jamais l'adresse", async () => {
      const body = await search({ q: `villa ${MARK}` })
      const item = body.items[0]!
      expect(item.location.precision).toBe("APPROXIMATE")
      expect(item.location.latitude).not.toBe(5.3625)
      expect(Math.abs(item.location.latitude! - 5.3625)).toBeLessThan(0.01)
      expect(JSON.stringify(body)).not.toContain("rue des Jardins")
    })
  })

  describe("tri, pagination, total, facettes", () => {
    it("trie par prix et pagine sans doublon ni trou", async () => {
      const seen: string[] = []
      let cursor: string | undefined
      let pages = 0
      do {
        const body = await search({
          q: MARK,
          sort: "PRICE_ASC",
          limit: "2",
          ...(cursor ? { cursor } : {}),
        })
        expect(body.total.strategy).toBe(
          pages === 0 ? "exact" : "not_available",
        )
        seen.push(...listingIds(body.items))
        cursor = body.pagination.nextCursor ?? undefined
        pages += 1
      } while (cursor && pages < 10)
      expect(seen).toHaveLength(FIXTURES.length)
      expect(new Set(seen).size).toBe(FIXTURES.length)
      expect(seen[0]).toBe(ids.appartMarcory)
      expect(seen[seen.length - 1]).toBe(ids.terrainBingerville)
    })

    it("compte le total et calcule les facettes demandées", async () => {
      const body = await search({
        q: MARK,
        facets: "propertyTypes,communes,bedrooms,priceRanges",
      })
      expect(body.total).toEqual({ value: FIXTURES.length, strategy: "exact" })
      expect(body.facets?.propertyTypes).toContainEqual({
        value: "APARTMENT",
        label: "Appartement",
        count: 2,
      })
      expect(body.facets?.communes).toContainEqual({
        value: "COCODY",
        label: "Cocody",
        count: 2,
      })
      expect(body.facets?.bedrooms).toContainEqual(
        expect.objectContaining({ value: "2", count: 2 }),
      )
      const priced = body.facets!.priceRanges!.reduce(
        (sum, bucket) => sum + bucket.count,
        0,
      )
      expect(priced).toBe(FIXTURES.length)
      expect(body.facets?.amenities).toBeUndefined()
    })

    it("trie par défaut par nouveauté sans texte", async () => {
      const body = await search({ commune: "TREICHVILLE" })
      expect(body.meta.sort).toBe("NEWEST")
      expect(body.items[0]?.score).toBeNull()
    })

    it("renvoie une structure d'aide quand rien ne correspond", async () => {
      const body = await search({
        q: MARK,
        commune: "COCODY",
        maxPrice: "100000",
      })
      expect(body.items).toEqual([])
      expect(body.total).toEqual({ value: 0, strategy: "exact" })
      expect(
        body.zeroResults?.relaxedFilters.map((filter) => filter.filter),
      ).toContain("maxPrice")
    })
  })

  describe("cohérence avec Listing", () => {
    it("retire les annonces mises en pause ou supprimées", async () => {
      const property = await createProperty(test, owner, {
        ...FIXTURES[0]!.property,
        title: "Villa éphémère",
      })
      const listing = await createListing(
        test,
        owner,
        property,
        "RENT",
        FIXTURES[0]!.price,
      )
      await indexer.syncListing(listing)
      expect(
        listingIds((await search({ q: `ephemere ${MARK}` })).items),
      ).toEqual([])

      await test.http
        .post(`/api/v1/listings/${listing}/publish`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await indexer.syncListing(listing)
      expect(
        listingIds((await search({ q: `ephemere ${MARK}` })).items),
      ).toEqual([listing])

      await test.http
        .post(`/api/v1/listings/${listing}/pause`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await indexer.syncListing(listing)
      expect((await search({ q: `ephemere ${MARK}` })).items).toEqual([])

      await test.http
        .delete(`/api/v1/listings/${listing}`)
        .set(owner.auth)
        .expect(204)
      await indexer.syncListing(listing)
      const rows = await test.db.query(
        `SELECT 1 FROM listing_search_documents d JOIN listings l ON l.id = d.listing_id WHERE l.public_id = $1`,
        [listing],
      )
      expect(rows.rowCount).toBe(0)
    })
  })

  describe("historique", () => {
    it("n'enregistre que les recherches soumises", async () => {
      const q = `historique ${MARK}`
      const count = async () =>
        Number(
          (
            await test.db.query(
              `SELECT count(*) AS n FROM searches WHERE query = $1`,
              [q],
            )
          ).rows[0].n,
        )
      await search({ q })
      expect(await count()).toBe(0)
      await test.http
        .get("/api/v1/search")
        .query({ q, submit: "true", commune: "COCODY" })
        .set(owner.auth)
        .expect(200)
      expect(await count()).toBe(1)
      const row = await test.db.query(
        `SELECT s.user_id IS NOT NULL AS linked, s.filters FROM searches s WHERE query = $1`,
        [q],
      )
      expect(row.rows[0].linked).toBe(true)
      expect(row.rows[0].filters).toMatchObject({ v: 1, communes: ["COCODY"] })
    })
  })

  describe("sécurité et validation", () => {
    it("neutralise les tentatives d'injection dans le texte", async () => {
      const body = await search({ q: "villa'; DROP TABLE listings; --" })
      expect(Array.isArray(body.items)).toBe(true)
      const stillThere = await test.db.query("SELECT count(*) FROM listings")
      expect(Number(stillThere.rows[0].count)).toBeGreaterThan(0)
      await search({ q: "a:* | !b & (c" })
    })

    it.each([
      [{ sort: "price; DROP TABLE x" }, "INVALID_SEARCH_QUERY"],
      [{ status: "DRAFT" }, "VALIDATION_FAILED"],
      [{ limit: "1000" }, "INVALID_SEARCH_QUERY"],
      [{ minPrice: "500", maxPrice: "100" }, "INVALID_PRICE_RANGE"],
      [{ minSurface: "200", maxSurface: "10" }, "INVALID_SURFACE_RANGE"],
      [{ lat: "95", lng: "-3.9" }, "INVALID_GEO_COORDINATES"],
      [{ lat: "5.3" }, "INVALID_GEO_COORDINATES"],
      [{ lat: "5.3", lng: "-3.9", radius: "500" }, "INVALID_RADIUS"],
      [{ cursor: "pas-un-curseur" }, "INVALID_CURSOR"],
      [{ commune: "ATLANTIS" }, "INVALID_SEARCH_QUERY"],
      [{ amenities: "TELEPORTEUR" }, "INVALID_SEARCH_QUERY"],
    ])("refuse %o (%s)", async (params, code) => {
      const response = await test.http
        .get("/api/v1/search")
        .query(params)
        .expect(400)
      expect(response.body.code).toBe(code)
    })

    it("refuse un curseur réutilisé avec d'autres filtres ou falsifié", async () => {
      const first = await search({ q: MARK, sort: "PRICE_ASC", limit: "2" })
      const cursor = first.pagination.nextCursor!
      const reused = await test.http
        .get("/api/v1/search")
        .query({
          q: MARK,
          sort: "PRICE_ASC",
          limit: "2",
          commune: "COCODY",
          cursor,
        })
        .expect(400)
      expect(reused.body.code).toBe("INVALID_CURSOR")
      const payload = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      ) as Record<string, unknown>
      const forged = Buffer.from(
        JSON.stringify({ ...payload, k: "0) OR 1=1 --" }),
      ).toString("base64url")
      const response = await test.http
        .get("/api/v1/search")
        .query({ q: MARK, sort: "PRICE_ASC", limit: "2", cursor: forged })
        .expect(400)
      expect(response.body.code).toBe("INVALID_CURSOR")
    })
  })

  describe("suggestions et santé", () => {
    it("propose lieux et types sans SQL par frappe", async () => {
      const body = await test.http
        .get("/api/v1/search/suggestions")
        .query({ q: "coc" })
        .expect(200)
      expect(body.body.items[0]).toMatchObject({
        type: "LOCATION",
        label: "Cocody, Abidjan",
        params: { commune: "COCODY" },
      })
      const typed = await test.http
        .get("/api/v1/search/suggestions")
        .query({ q: "appart" })
        .expect(200)
      expect(
        typed.body.items.map((item: { type: string }) => item.type),
      ).toContain("PROPERTY_TYPE")
      await test.http
        .get("/api/v1/search/suggestions")
        .query({ q: "a" })
        .expect(400)
    })

    it("expose l'état du moteur sur /health/search", async () => {
      const body = await test.http.get("/health/search").expect(200)
      expect(body.body).toMatchObject({
        status: "ok",
        service: "search:postgres",
        checks: { postgres_search: { status: "up" } },
      })
    })
  })

  describe("performance (indicative)", () => {
    it("répond en moins de 500 ms au p95 sur des requêtes typiques", async () => {
      const queries: Array<Record<string, string>> = [
        { q: "villa cocody" },
        { q: "appartement", commune: "MARCORY", sort: "PRICE_ASC" },
        { listingType: "RENT", minPrice: "100000", maxPrice: "2000000" },
        { lat: "5.36", lng: "-3.96", radius: "10", sort: "DISTANCE" },
        { q: "terrain", facets: "propertyTypes,communes,priceRanges" },
      ]
      const timings: number[] = []
      for (let round = 0; round < 4; round += 1) {
        for (const params of queries) {
          const started = performance.now()
          await search({ ...params, limit: "20" })
          timings.push(performance.now() - started)
        }
      }
      timings.sort((a, b) => a - b)
      const p95 = timings[Math.floor(timings.length * 0.95) - 1]!
      expect(p95).toBeLessThan(500)
    })
  })
})
