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

describe("Property : biens immobiliers", () => {
  let test: IdentityTestApp
  let ownerA: TestUser
  let ownerB: TestUser
  let customer: TestUser
  let agent: TestUser
  let admin: TestUser

  beforeAll(async () => {
    test = await createIdentityApp()
    ownerA = await userWithRoles(test, ["OWNER"])
    ownerB = await userWithRoles(test, ["OWNER"])
    customer = await userWithRoles(test, [])
    agent = await userWithRoles(test, ["AGENT"])
    admin = await userWithRoles(test, ["ADMIN"])
  })

  afterAll(async () => {
    await test.close()
  })

  describe("création", () => {
    it("crée un brouillon rattaché au compte courant, audité", async () => {
      const response = await test.http
        .post("/api/v1/properties")
        .set(ownerA.auth)
        .send(VILLA_COCODY)
        .expect(201)
      const body = response.body
      expect(body).toMatchObject({
        title: VILLA_COCODY.title,
        status: "DRAFT",
        relation: "SOLE",
        surface: "280",
        propertyType: { code: "VILLA", category: "RESIDENTIAL" },
        location: {
          commune: { code: "COCODY" },
          neighborhood: { code: "RIVIERA" },
          latitude: 5.3625,
          precision: "EXACT",
          address: VILLA_COCODY.address,
        },
        locationVisibility: "APPROXIMATE",
        completeness: { complete: true, missing: [] },
      })
      expect(
        body.amenities.map((a: { code: string }) => a.code).sort(),
      ).toEqual(["GARDEN", "PARKING", "SECURITY"])
      const actions = (await auditActions(test, body.id)).map(
        (row) => row.action,
      )
      expect(actions).toEqual(["PROPERTY_CREATED", "OWNERSHIP_CHANGED"])
    })

    it("refuse un ownerId fourni par le client", async () => {
      const response = await test.http
        .post("/api/v1/properties")
        .set(ownerA.auth)
        .send({ ...VILLA_COCODY, ownerId: ownerB.userId })
        .expect(400)
      expect(response.body.code).toBe("VALIDATION_FAILED")
    })

    it("refuse la création à un client (CUSTOMER)", async () => {
      const response = await test.http
        .post("/api/v1/properties")
        .set(customer.auth)
        .send(VILLA_COCODY)
        .expect(403)
      expect(response.body.code).toBe("INSUFFICIENT_PERMISSION")
      await test.http.post("/api/v1/properties").send(VILLA_COCODY).expect(401)
    })

    it.each([
      [{ propertyType: "CASTLE" }, "INVALID_PROPERTY_TYPE"],
      [{ latitude: 48.8566, longitude: 2.3522 }, "INVALID_LOCATION"],
      [{ neighborhood: "ZONE_4" }, "INVALID_LOCATION"],
      [{ latitude: 5.36, longitude: null }, "INVALID_LOCATION"],
      [{ attributes: { swimmingPoolSize: 12 } }, "INVALID_PROPERTY_DATA"],
      [{ amenities: ["HELIPORT"] }, "INVALID_AMENITY"],
    ])("refuse des données invalides (%o)", async (patch, code) => {
      const response = await test.http
        .post("/api/v1/properties")
        .set(ownerA.auth)
        .send({ ...VILLA_COCODY, ...patch })
        .expect(422)
      expect(response.body.code).toBe(code)
    })

    it("refuse des chambres sur un terrain", async () => {
      const response = await test.http
        .post("/api/v1/properties")
        .set(ownerA.auth)
        .send({ ...LAND_BINGERVILLE, bedrooms: 2 })
        .expect(422)
      expect(response.body.code).toBe("INVALID_PROPERTY_DATA")
    })

    it("réserve le rattachement AGENT aux professionnels", async () => {
      const refused = await test.http
        .post("/api/v1/properties")
        .set(ownerA.auth)
        .send({ ...VILLA_COCODY, ownershipType: "AGENT" })
        .expect(403)
      expect(refused.body.code).toBe("INVALID_OWNERSHIP_TYPE")
      const created = await test.http
        .post("/api/v1/properties")
        .set(agent.auth)
        .send(VILLA_COCODY)
        .expect(201)
      expect(created.body.relation).toBe("AGENT")
    })
  })

  describe("visibilité et confidentialité", () => {
    it("masque un brouillon, publie un bien actif avec localisation approximative", async () => {
      const id = await createProperty(test, ownerA, VILLA_COCODY, false)
      const anonymousDraft = await test.http
        .get(`/api/v1/properties/${id}`)
        .expect(404)
      expect(anonymousDraft.body.code).toBe("PROPERTY_NOT_FOUND")

      await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .send({ status: "ACTIVE" })
        .expect(200)
      const publicView = await test.http
        .get(`/api/v1/properties/${id}`)
        .expect(200)
      expect(publicView.body.status).toBeUndefined()
      expect(publicView.body.completeness).toBeUndefined()
      expect(publicView.body.location).toMatchObject({
        latitude: 5.36,
        longitude: -3.96,
        precision: "APPROXIMATE",
        address: null,
      })

      // Un jeton invalide ne bloque pas la lecture publique.
      await test.http
        .get(`/api/v1/properties/${id}`)
        .set({ Authorization: "Bearer jeton-invalide" })
        .expect(200)
    })

    it("ne révèle aucune coordonnée en HIDDEN", async () => {
      const id = await createProperty(test, ownerA, {
        ...VILLA_COCODY,
        locationVisibility: "HIDDEN",
      })
      const response = await test.http
        .get(`/api/v1/properties/${id}`)
        .expect(200)
      expect(response.body.location).toMatchObject({
        latitude: null,
        longitude: null,
        precision: "NONE",
        address: null,
        commune: { code: "COCODY" },
      })
    })

    it("refuse l'activation d'un bien incomplet", async () => {
      const id = await createProperty(
        test,
        ownerA,
        {
          ...VILLA_COCODY,
          latitude: undefined,
          longitude: undefined,
          bedrooms: undefined,
        },
        false,
      )
      const response = await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .send({ status: "ACTIVE" })
        .expect(422)
      expect(response.body.code).toBe("PROPERTY_INCOMPLETE")
      expect(response.body.message).toContain("coordinates")
    })
  })

  describe("autorisations", () => {
    it("OWNER A ne modifie pas le bien de OWNER B (403 si public, 404 sinon)", async () => {
      const active = await createProperty(test, ownerB)
      const draft = await createProperty(test, ownerB, VILLA_COCODY, false)
      const forbidden = await test.http
        .patch(`/api/v1/properties/${active}`)
        .set(ownerA.auth)
        .send({ title: "Prise de contrôle" })
        .expect(403)
      expect(forbidden.body.code).toBe("PROPERTY_ACCESS_DENIED")
      const hidden = await test.http
        .patch(`/api/v1/properties/${draft}`)
        .set(ownerA.auth)
        .send({ title: "Prise de contrôle" })
        .expect(404)
      expect(hidden.body.code).toBe("PROPERTY_NOT_FOUND")
    })

    it("ADMIN modifie tout bien, avec une trace de dérogation", async () => {
      const id = await createProperty(test, ownerB, VILLA_COCODY, false)
      const response = await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(admin.auth)
        .send({ title: "Titre corrigé par la modération" })
        .expect(200)
      expect(response.body.relation).toBeNull()
      const updates = (await auditActions(test, id)).filter(
        (row) => row.action === "PROPERTY_UPDATED",
      )
      expect(updates.at(-1)?.new_values).toMatchObject({ adminOverride: true })
    })

    it("AGENT : seulement sur un bien assigné, sans pouvoir le supprimer", async () => {
      const id = await createProperty(test, ownerA)
      await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(agent.auth)
        .send({ bedrooms: 5 })
        .expect(403)
      await assign(test, id, agent.userId, "AGENT")
      const updated = await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(agent.auth)
        .send({ bedrooms: 5 })
        .expect(200)
      expect(updated.body).toMatchObject({ bedrooms: 5, relation: "AGENT" })
      const deletion = await test.http
        .delete(`/api/v1/properties/${id}`)
        .set(agent.auth)
        .expect(403)
      expect(deletion.body.code).toBe("PROPERTY_ACCESS_DENIED")
    })

    it("refuse null sur un champ obligatoire et l'accepte sur un champ facultatif", async () => {
      const id = await createProperty(test, ownerA, VILLA_COCODY, false)
      await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .send({ title: null })
        .expect(400)
      const cleared = await test.http
        .patch(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .send({ description: null })
        .expect(200)
      expect(cleared.body.description).toBeNull()
    })
  })

  describe("équipements", () => {
    it("remplace la liste par différence, sans doublon", async () => {
      const id = await createProperty(test, ownerA)
      const response = await test.http
        .put(`/api/v1/properties/${id}/amenities`)
        .set(ownerA.auth)
        .send({ amenities: ["PARKING", "PARKING", "SWIMMING_POOL"] })
        .expect(200)
      expect(
        response.body.amenities.map((a: { code: string }) => a.code),
      ).toEqual(["PARKING", "SWIMMING_POOL"])
      const last = (await auditActions(test, id)).at(-1)
      expect(last?.new_values).toMatchObject({
        amenities: { added: ["SWIMMING_POOL"] },
      })
      const removed = (last?.new_values?.amenities as { removed: string[] })
        .removed
      expect(removed.sort()).toEqual(["GARDEN", "SECURITY"])

      const unknown = await test.http
        .put(`/api/v1/properties/${id}/amenities`)
        .set(ownerA.auth)
        .send({ amenities: ["HELIPORT"] })
        .expect(422)
      expect(unknown.body.code).toBe("INVALID_AMENITY")
    })
  })

  describe("suppression logique", () => {
    it("refuse tant qu'une annonce est en cours, puis masque le bien", async () => {
      const id = await createProperty(test, ownerA)
      const listing = await createListing(test, ownerA, id, "RENT", {
        amount: 1_500_000,
        period: "MONTH",
      })
      await test.http
        .post(`/api/v1/listings/${listing}/publish`)
        .set(ownerA.auth)
        .send({})
        .expect(200)

      const blocked = await test.http
        .delete(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .expect(409)
      expect(blocked.body.code).toBe("PROPERTY_HAS_ACTIVE_LISTINGS")

      await test.http
        .post(`/api/v1/listings/${listing}/status`)
        .set(ownerA.auth)
        .send({ status: "ARCHIVED" })
        .expect(200)
      await test.http
        .delete(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .expect(204)
      await test.http
        .get(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .expect(404)
      const again = await test.http
        .delete(`/api/v1/properties/${id}`)
        .set(ownerA.auth)
        .expect(409)
      expect(again.body.code).toBe("PROPERTY_ALREADY_DELETED")

      const row = await test.db.query<{ deleted_at: Date | null }>(
        "SELECT deleted_at FROM properties WHERE public_id = $1",
        [id],
      )
      expect(row.rows[0]?.deleted_at).toBeInstanceOf(Date)
    })
  })

  describe("recherche", () => {
    let villa: string
    let land: string

    beforeAll(async () => {
      villa = await createProperty(test, ownerB, VILLA_COCODY)
      land = await createProperty(test, ownerB, LAND_BINGERVILLE)
    })

    it("filtre par type, commune, surface et chambres", async () => {
      const response = await test.http
        .get("/api/v1/properties")
        .query({
          propertyType: "VILLA",
          commune: "COCODY",
          minSurface: 250,
          bedrooms: 4,
          limit: 100,
        })
        .expect(200)
      const ids = response.body.items.map((item: { id: string }) => item.id)
      expect(ids).toContain(villa)
      expect(ids).not.toContain(land)
      expect(response.body.items[0].status).toBeUndefined()
    })

    it("trouve les biens à moins de 5 km (PostGIS)", async () => {
      const response = await test.http
        .get("/api/v1/properties")
        .query({ latitude: 5.36, longitude: -3.96, radiusKm: 5, limit: 100 })
        .expect(200)
      const ids = response.body.items.map((item: { id: string }) => item.id)
      expect(ids).toContain(villa)
      // Feh Kessé est à ~8 km de Riviera.
      expect(ids).not.toContain(land)
    })

    it("exclut les biens masqués des recherches publiques par rayon", async () => {
      const hidden = await createProperty(test, ownerB, {
        ...VILLA_COCODY,
        locationVisibility: "HIDDEN",
      })
      const response = await test.http
        .get("/api/v1/properties")
        .query({ latitude: 5.36, longitude: -3.96, radiusKm: 5, limit: 100 })
        .expect(200)
      expect(
        response.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(hidden)
    })

    it("filtre les biens approximatifs sur leur position publiée, pas la réelle", async () => {
      // ≈ 445 m de la position réelle, ≈ 735 m de la position arrondie (5.36, -3.96).
      const probe = {
        latitude: 5.3665,
        longitude: -3.9612,
        radiusKm: 0.5,
        limit: 100,
      }
      const anonymous = await test.http
        .get("/api/v1/properties")
        .query(probe)
        .expect(200)
      expect(
        anonymous.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(villa)

      const owner = await test.http
        .get("/api/v1/properties")
        .query({ ...probe, scope: "mine" })
        .set(ownerB.auth)
        .expect(200)
      expect(owner.body.items.map((item: { id: string }) => item.id)).toContain(
        villa,
      )
    })

    it("pagine par curseur sans doublon", async () => {
      const first = await test.http
        .get("/api/v1/properties")
        .query({ scope: "mine", limit: 1 })
        .set(ownerB.auth)
        .expect(200)
      expect(first.body.items).toHaveLength(1)
      expect(first.body.nextCursor).toEqual(expect.any(String))
      const second = await test.http
        .get("/api/v1/properties")
        .query({ scope: "mine", limit: 1, cursor: first.body.nextCursor })
        .set(ownerB.auth)
        .expect(200)
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id)

      const invalid = await test.http
        .get("/api/v1/properties")
        .query({ cursor: "pas-un-curseur" })
        .expect(400)
      expect(invalid.body.code).toBe("INVALID_CURSOR")
    })

    it("scope=mine : biens gérés tous statuts ; exige une authentification", async () => {
      const draft = await createProperty(test, ownerB, VILLA_COCODY, false)
      const mine = await test.http
        .get("/api/v1/properties")
        .query({ scope: "mine", status: "DRAFT", limit: 100 })
        .set(ownerB.auth)
        .expect(200)
      expect(mine.body.items.map((item: { id: string }) => item.id)).toContain(
        draft,
      )
      expect(mine.body.items[0].status).toBe("DRAFT")
      await test.http
        .get("/api/v1/properties")
        .query({ scope: "mine" })
        .expect(401)
      const all = await test.http
        .get("/api/v1/properties")
        .query({ scope: "all" })
        .set(ownerB.auth)
        .expect(403)
      expect(all.body.code).toBe("PROPERTY_ACCESS_DENIED")
    })
  })

  describe("référentiels publics", () => {
    it("liste les types actifs et les équipements par catégorie", async () => {
      const types = await test.http.get("/api/v1/property-types").expect(200)
      expect(types.body).toEqual(
        expect.arrayContaining([
          { code: "VILLA", name: "Villa", category: "RESIDENTIAL" },
        ]),
      )
      const amenities = await test.http.get("/api/v1/amenities").expect(200)
      expect(amenities.body).toEqual(
        expect.arrayContaining([
          { code: "GENERATOR", name: "Groupe électrogène", category: "ENERGY" },
        ]),
      )
    })
  })
})
