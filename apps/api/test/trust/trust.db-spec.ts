import { rm } from "node:fs/promises"

import { ListingConfig } from "../../src/modules/listing/listing.config"
import { MediaConfig } from "../../src/modules/media/media.config"
import { TrustMaintenanceService } from "../../src/modules/trust"
import {
  assign,
  auditActions,
  createListing,
  createProperty,
  LAND_BINGERVILLE,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"
import {
  attachDocument,
  fakeDocument,
  notificationsOf,
  openVerification,
  review,
  submit,
  verifiedIdentity,
} from "./trust-app"

const SECRET_NOTE = "note-interne-confidentielle-7f3a"
const DAY = 86_400_000

describe("Trust : vérifications, signalements, badges", () => {
  let test: IdentityTestApp
  let alice: TestUser
  let stranger: TestUser
  let officer: TestUser
  let moderator: TestUser
  let admin: TestUser
  let alicePropertyId: string
  let identityId: string

  beforeAll(async () => {
    test = await createIdentityApp()
    alice = await userWithRoles(test, ["OWNER"])
    stranger = await userWithRoles(test, ["CUSTOMER"])
    officer = await userWithRoles(test, ["TRUST_OFFICER"])
    moderator = await userWithRoles(test, ["MODERATOR"])
    admin = await userWithRoles(test, ["ADMIN"])
    alicePropertyId = await createProperty(test, alice)
  })

  afterAll(async () => {
    const root = test.app.get(MediaConfig).local.root
    await test.close()
    await rm(root, { recursive: true, force: true })
  })

  const getOwn = (user: TestUser, id: string, status = 200) =>
    test.http
      .get(`/api/v1/trust/verifications/${id}`)
      .set(user.auth)
      .expect(status)

  const reviewDetail = (user: TestUser, id: string, status = 200) =>
    test.http
      .get(`/api/v1/admin/trust/verifications/${id}`)
      .set(user.auth)
      .expect(status)

  const userBadges = async (user: TestUser) =>
    (
      await test.http
        .get(`/api/v1/trust/users/${user.userId}/badges`)
        .expect(200)
    ).body.badges.map((badge: { code: string }) => badge.code)

  describe("workflow d'identité", () => {
    it("un fichier envoyé ne vaut pas vérification", async () => {
      const created = await openVerification(test, alice, {
        type: "IDENTITY",
        declaration: { statement: "Pièce en cours de validité" },
      })
      identityId = created.body.id
      expect(created.body).toMatchObject({ status: "DRAFT", submittedAt: null })

      const refused = await submit(test, alice, identityId, 422)
      expect(refused.body.code).toBe("DOCUMENTS_INCOMPLETE")

      await attachDocument(test, alice, identityId, "NATIONAL_ID")
      const draft = await getOwn(alice, identityId)
      expect(draft.body.status).toBe("DRAFT")
      expect(draft.body.documents).toHaveLength(1)
      expect(draft.body.requirements.missing).toEqual([])
      expect(await userBadges(alice)).not.toContain("IDENTITY_VERIFIED")
    })

    it("refuse une pièce non acceptée et une soumission sans déclaration sur l'honneur", async () => {
      const wrong = await test.http
        .post(`/api/v1/trust/verifications/${identityId}/documents`)
        .set(alice.auth)
        .send({
          documentType: "TITLE_DEED",
          mimeType: "application/pdf",
          size: 100,
        })
        .expect(422)
      expect(wrong.body.code).toBe("DOCUMENT_TYPE_NOT_ACCEPTED")
      await test.http
        .post(`/api/v1/trust/verifications/${identityId}/submit`)
        .set(alice.auth)
        .send({ attestation: false })
        .expect(400)
    })

    it("soumet le dossier et refuse un second dossier ouvert du même type", async () => {
      const submitted = await submit(test, alice, identityId)
      expect(submitted.body.status).toBe("PENDING")
      expect(submitted.body).not.toHaveProperty("prechecks")
      const duplicate = await openVerification(
        test,
        alice,
        { type: "IDENTITY" },
        409,
      )
      expect(duplicate.body.code).toBe("VERIFICATION_ALREADY_OPEN")
    })

    it("aucune route utilisateur ne décide d'un dossier", async () => {
      for (const action of ["approve", "assign", "reject"]) {
        await review(
          test,
          alice,
          identityId,
          action,
          { reasonCode: "OTHER" },
          403,
        )
      }
      await test.http
        .patch(`/api/v1/trust/verifications/${identityId}`)
        .set(alice.auth)
        .send({ status: "VERIFIED" })
        .expect(404)
    })

    it("le modérateur instruit mais ne décide pas", async () => {
      const assigned = await review(test, moderator, identityId, "assign", {
        internalNote: SECRET_NOTE,
      })
      expect(assigned.body).toMatchObject({
        status: "IN_REVIEW",
        assignedTo: moderator.userId,
      })
      await review(test, moderator, identityId, "approve", {}, 403)
      await review(
        test,
        moderator,
        identityId,
        "reject",
        { reasonCode: "OTHER" },
        403,
      )
    })

    it("l'administrateur technique n'accède pas aux pièces et ne décide pas sur pièces", async () => {
      const detail = await reviewDetail(admin, identityId)
      const documentId = detail.body.documents[0].id
      await test.http
        .get(
          `/api/v1/admin/trust/verifications/${identityId}/documents/${documentId}/download`,
        )
        .set(admin.auth)
        .expect(403)
      const refused = await review(test, admin, identityId, "approve", {}, 403)
      expect(refused.body.code).toBe("DECISION_PERMISSION_REQUIRED")
    })

    it("demande un complément sans jamais exposer la note interne au déclarant", async () => {
      const response = await review(
        test,
        officer,
        identityId,
        "request-information",
        {
          reasonCode: "DOCUMENT_ILLEGIBLE",
          message: "Merci d'envoyer le verso.",
          internalNote: SECRET_NOTE,
        },
      )
      expect(response.body.status).toBe("NEEDS_MORE_INFORMATION")

      const own = await getOwn(alice, identityId)
      expect(own.body.reason.code).toBe("DOCUMENT_ILLEGIBLE")
      expect(JSON.stringify(own.body)).not.toContain(SECRET_NOTE)
      expect(own.body.history.at(-1).message).toBe("Merci d'envoyer le verso.")
      for (const entry of own.body.history) {
        expect(entry).not.toHaveProperty("internalNote")
        expect(entry).not.toHaveProperty("actorId")
      }

      const notices = await notificationsOf(test, alice)
      expect(JSON.stringify(notices)).not.toContain(SECRET_NOTE)
      expect(notices[0]).toMatchObject({ type: "VERIFICATION" })
      expect(notices[0]!.body).toContain("verso")

      const reviewer = await reviewDetail(officer, identityId)
      expect(JSON.stringify(reviewer.body.history)).toContain(SECRET_NOTE)
      const audit = await auditActions(test, identityId)
      expect(JSON.stringify(audit)).not.toContain(SECRET_NOTE)
    })

    it("après complément, l'agent de confiance consulte la pièce (accès audité) puis approuve", async () => {
      await attachDocument(test, alice, identityId, "PASSPORT")
      const resubmitted = await submit(test, alice, identityId)
      expect(resubmitted.body.status).toBe("PENDING")

      const detail = await reviewDetail(officer, identityId)
      const documentId = detail.body.documents[0].id
      const link = await test.http
        .get(
          `/api/v1/admin/trust/verifications/${identityId}/documents/${documentId}/download`,
        )
        .set(officer.auth)
        .expect(200)
      expect(new Date(link.body.expiresAt).getTime()).toBeLessThan(
        Date.now() + 15 * 60_000,
      )

      const approved = await review(test, officer, identityId, "approve", {
        message: "Pièce lisible.",
      })
      expect(approved.body.status).toBe("VERIFIED")
      expect(new Date(approved.body.expiresAt).getTime()).toBeGreaterThan(
        Date.now() + 365 * DAY,
      )
      expect(await userBadges(alice)).toContain("IDENTITY_VERIFIED")

      const actions = (await auditActions(test, identityId)).map(
        (entry) => entry.action,
      )
      expect(actions).toEqual(
        expect.arrayContaining([
          "VERIFICATION_CREATED",
          "VERIFICATION_SUBMITTED",
          "VERIFICATION_DOCUMENT_ACCESSED",
          "VERIFICATION_APPROVED",
        ]),
      )
      const keys = await test.db.query<{ storage_key: string }>(
        `SELECT m.storage_key FROM verification_documents d
         JOIN verifications v ON v.id = d.verification_id
         JOIN media m ON m.id = d.media_id WHERE v.public_id = $1`,
        [identityId],
      )
      const audit = JSON.stringify(await auditActions(test, identityId))
      for (const row of keys.rows) expect(audit).not.toContain(row.storage_key)
    })

    it("une décision rendue n'est plus modifiable", async () => {
      const again = await review(
        test,
        officer,
        identityId,
        "reject",
        { reasonCode: "OTHER" },
        409,
      )
      expect(again.body.code).toBe("INVALID_VERIFICATION_TRANSITION")
    })

    it("l'historique des dossiers est en ajout seul", async () => {
      await expect(
        test.db.query(
          `UPDATE verification_events SET internal_note = NULL
           WHERE verification_id = (SELECT id FROM verifications WHERE public_id = $1)`,
          [identityId],
        ),
      ).rejects.toThrow()
      await expect(
        test.db.query(
          `DELETE FROM verification_events
           WHERE verification_id = (SELECT id FROM verifications WHERE public_id = $1)`,
          [identityId],
        ),
      ).rejects.toThrow()
    })
  })

  describe("indépendance et cloisonnement", () => {
    it("un agent de confiance ne traite pas son propre dossier", async () => {
      const created = await openVerification(test, officer, {
        type: "IDENTITY",
      })
      await attachDocument(test, officer, created.body.id, "PASSPORT")
      await submit(test, officer, created.body.id)
      const own = await review(
        test,
        officer,
        created.body.id,
        "approve",
        {},
        403,
      )
      expect(own.body.code).toBe("SELF_REVIEW_FORBIDDEN")
      await reviewDetail(officer, created.body.id, 403)
    })

    it("un autre utilisateur ne voit ni ne modifie le dossier d'autrui", async () => {
      await getOwn(stranger, identityId, 404)
      await test.http
        .post(`/api/v1/trust/verifications/${identityId}/withdraw`)
        .set(stranger.auth)
        .expect(404)
      await test.http
        .post(`/api/v1/trust/verifications/${identityId}/documents`)
        .set(stranger.auth)
        .send({
          documentType: "PASSPORT",
          mimeType: "application/pdf",
          size: 100,
        })
        .expect(404)
      const list = await test.http
        .get("/api/v1/trust/verifications")
        .set(stranger.auth)
        .expect(200)
      expect(
        list.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(identityId)
    })

    it("masque les badges d'un compte suspendu", async () => {
      const suspended = await userWithRoles(test, ["OWNER"])
      await test.db.query(
        "UPDATE users SET status = 'SUSPENDED' WHERE public_id = $1",
        [suspended.userId],
      )
      await test.http
        .get(`/api/v1/trust/users/${suspended.userId}/badges`)
        .expect(404)
    })

    it("un brouillon n'apparaît pas dans la file des relecteurs", async () => {
      const draft = await openVerification(test, stranger, { type: "IDENTITY" })
      await reviewDetail(officer, draft.body.id, 404)
    })
  })

  describe("propriété, pièces privées et publication", () => {
    let ownershipId: string
    let listingId: string
    let agent: TestUser
    let listingConfig: ListingConfig
    let previousRequirements: string[]

    beforeAll(async () => {
      agent = await userWithRoles(test, ["AGENT"])
      await assign(test, alicePropertyId, agent.userId, "MANAGER")
      listingConfig = test.app.get(ListingConfig)
      previousRequirements = [...listingConfig.publicationRequirements]
      Object.assign(listingConfig, {
        publicationRequirements: ["IDENTITY", "PUBLICATION_RIGHT"],
      })
    })

    afterAll(() => {
      Object.assign(listingConfig, {
        publicationRequirements: previousRequirements,
      })
    })

    it("exige un rattachement revendiqué cohérent et un bien géré", async () => {
      const missing = await openVerification(
        test,
        alice,
        { type: "PROPERTY_OWNERSHIP", propertyId: alicePropertyId },
        422,
      )
      expect(missing.body.code).toBe("CLAIMED_RELATION_INVALID")
      await openVerification(
        test,
        stranger,
        {
          type: "PROPERTY_OWNERSHIP",
          propertyId: alicePropertyId,
          claimedRelation: "SOLE",
        },
        404,
      )
    })

    it("exige une identité vérifiée avant un dossier de propriété", async () => {
      const bob = await userWithRoles(test, ["OWNER"])
      const land = await createProperty(test, bob, LAND_BINGERVILLE)
      const created = await openVerification(test, bob, {
        type: "PROPERTY_OWNERSHIP",
        propertyId: land,
        claimedRelation: "SOLE",
      })
      // Un permis de construire ne prouve pas la propriété d'un terrain.
      const permit = await test.http
        .post(`/api/v1/trust/verifications/${created.body.id}/documents`)
        .set(bob.auth)
        .send({
          documentType: "BUILDING_PERMIT",
          mimeType: "application/pdf",
          size: 100,
        })
        .expect(422)
      expect(permit.body.code).toBe("DOCUMENT_TYPE_NOT_ACCEPTED")
      await attachDocument(test, bob, created.body.id, "CONCESSION_DECREE")
      const refused = await submit(test, bob, created.body.id, 422)
      expect(refused.body.code).toBe("IDENTITY_VERIFICATION_REQUIRED")
    })

    it("refuse la publication tant que les vérifications exigées manquent", async () => {
      listingId = await createListing(test, alice, alicePropertyId, "RENT", {
        amount: 450_000,
        period: "MONTH",
      })
      const refused = await test.http
        .post(`/api/v1/listings/${listingId}/publish`)
        .set(alice.auth)
        .send({})
        .expect(422)
      expect(refused.body.code).toBe("VERIFICATION_REQUIRED")
    })

    it("garde les pièces hors de la galerie et hors de portée des co-gestionnaires", async () => {
      const created = await openVerification(test, alice, {
        type: "PROPERTY_OWNERSHIP",
        propertyId: alicePropertyId,
        claimedRelation: "SOLE",
      })
      ownershipId = created.body.id
      const { uploadId } = await attachDocument(
        test,
        alice,
        ownershipId,
        "TITLE_DEED",
      )

      await getOwn(agent, ownershipId, 404)
      await test.http
        .get(`/api/v1/media/upload-sessions/${uploadId}`)
        .set(agent.auth)
        .expect(404)
      for (const user of [alice, agent]) {
        const gallery = await test.http
          .get(`/api/v1/properties/${alicePropertyId}/media`)
          .set(user.auth)
          .expect(200)
        expect(
          gallery.body.items.map((item: { id: string }) => item.id),
        ).not.toContain(uploadId)
      }
      const row = await test.db.query<{
        purpose: string
        visibility: string
        property_id: string | null
      }>(
        "SELECT purpose, visibility, property_id FROM media WHERE public_id = $1",
        [uploadId],
      )
      expect(row.rows[0]).toEqual({
        purpose: "VERIFICATION",
        visibility: "PRIVATE",
        property_id: null,
      })
    })

    it("un relecteur rattaché au bien est en conflit d'intérêts", async () => {
      await submit(test, alice, ownershipId)
      const conflicted = await userWithRoles(test, ["TRUST_OFFICER"])
      await assign(test, alicePropertyId, conflicted.userId, "AGENT")
      const refused = await review(
        test,
        conflicted,
        ownershipId,
        "approve",
        {},
        403,
      )
      expect(refused.body.code).toBe("CONFLICT_OF_INTEREST")
    })

    it("publie après approbation, avec des badges factuels", async () => {
      await review(test, officer, ownershipId, "approve")
      await test.http
        .post(`/api/v1/listings/${listingId}/publish`)
        .set(alice.auth)
        .send({})
        .expect(200)
      const badges = await test.http
        .get(`/api/v1/trust/listings/${listingId}/badges`)
        .expect(200)
      expect(
        badges.body.badges.map((badge: { code: string }) => badge.code),
      ).toContain("PUBLICATION_RIGHT_VERIFIED")
      expect(
        badges.body.publisherBadges.map(
          (badge: { code: string }) => badge.code,
        ),
      ).toContain("IDENTITY_VERIFIED")
      expect(badges.body.disclaimer).toMatch(/ni une garantie/)
      expect(JSON.stringify(badges.body)).not.toMatch(/garanti |sans risque/i)
    })

    it("signale un même fichier envoyé par deux comptes, sans rien décider", async () => {
      const shared = fakeDocument()
      const victim = await userWithRoles(test, ["CUSTOMER"])
      const first = await openVerification(test, victim, { type: "IDENTITY" })
      await attachDocument(test, victim, first.body.id, "PASSPORT", shared)
      await submit(test, victim, first.body.id)

      const mallory = await userWithRoles(test, ["CUSTOMER"])
      const second = await openVerification(test, mallory, { type: "IDENTITY" })
      await attachDocument(test, mallory, second.body.id, "PASSPORT", shared)
      const submitted = await submit(test, mallory, second.body.id)
      expect(submitted.body.status).toBe("PENDING")

      const detail = await reviewDetail(officer, second.body.id)
      expect(detail.body.priority).toBe("HIGH")
      expect(
        detail.body.signals.map(
          (signal: { ruleCode: string }) => signal.ruleCode,
        ),
      ).toContain("DUPLICATE_DOCUMENT")
      const own = await getOwn(mallory, second.body.id)
      expect(JSON.stringify(own.body)).not.toContain("DUPLICATE_DOCUMENT")
    })
  })

  describe("signalements", () => {
    let listingId: string
    let reportId: string

    beforeAll(async () => {
      const property = await createProperty(test, alice)
      listingId = await createListing(test, alice, property, "RENT", {
        amount: 200_000,
        period: "MONTH",
      })
      const right = await openVerification(test, alice, {
        type: "PROPERTY_OWNERSHIP",
        propertyId: property,
        claimedRelation: "SOLE",
      })
      await attachDocument(test, alice, right.body.id, "TITLE_DEED")
      await submit(test, alice, right.body.id)
      await review(test, officer, right.body.id, "approve")
      await test.http
        .post(`/api/v1/listings/${listingId}/publish`)
        .set(alice.auth)
        .send({})
        .expect(200)
    })

    const report = (user: TestUser, body: Record<string, unknown>) =>
      test.http.post("/api/v1/trust/reports").set(user.auth).send(body)

    it("exige une connexion", async () => {
      await test.http
        .post("/api/v1/trust/reports")
        .send({ targetType: "LISTING", listingId, reason: "SUSPECTED_SCAM" })
        .expect(401)
    })

    it("refuse l'auto-signalement et le doublon ouvert", async () => {
      const self = await report(alice, {
        targetType: "LISTING",
        listingId,
        reason: "OTHER",
      }).expect(422)
      expect(self.body.code).toBe("REPORT_SELF_FORBIDDEN")
      await report(alice, {
        targetType: "USER",
        userId: alice.userId,
        reason: "OTHER",
      }).expect(422)

      const created = await report(stranger, {
        targetType: "LISTING",
        listingId,
        reason: "SUSPECTED_SCAM",
        description: "Demande d'acompte avant visite.",
      }).expect(201)
      reportId = created.body.id
      expect(created.body.status).toBe("OPEN")
      const again = await report(stranger, {
        targetType: "LISTING",
        listingId,
        reason: "INCORRECT_PRICE",
      }).expect(409)
      expect(again.body.code).toBe("REPORT_ALREADY_OPEN")
      const audit = JSON.stringify(await auditActions(test, reportId))
      expect(audit).not.toContain("acompte")
    })

    it("au seuil, priorise l'examen sans suspendre l'annonce", async () => {
      for (let index = 0; index < 2; index++) {
        const reporter = await userWithRoles(test, ["CUSTOMER"])
        await report(reporter, {
          targetType: "LISTING",
          listingId,
          reason: "SUSPECTED_SCAM",
        }).expect(201)
      }
      const listing = await test.http
        .get(`/api/v1/listings/${listingId}`)
        .expect(200)
      expect(listing.body.status).toBe("PUBLISHED")
      let mine: unknown
      let cursor: string | undefined
      do {
        const queue = await test.http
          .get("/api/v1/admin/trust/reports")
          .query({
            priority: "HIGH",
            targetType: "LISTING",
            limit: 100,
            ...(cursor ? { cursor } : {}),
          })
          .set(moderator.auth)
          .expect(200)
        mine = queue.body.items.find(
          (item: { id: string }) => item.id === reportId,
        )
        cursor = queue.body.nextCursor ?? undefined
      } while (!mine && cursor)
      expect(mine).toMatchObject({ priority: "HIGH", openReportsOnTarget: 3 })
      const signals = await test.http
        .get("/api/v1/admin/trust/signals?status=OPEN")
        .set(moderator.auth)
        .expect(200)
      expect(
        signals.body.items.some(
          (signal: { ruleCode: string }) =>
            signal.ruleCode === "REPORT_THRESHOLD",
        ),
      ).toBe(true)
    })

    it("cache les signalements d'autrui et la file aux non-modérateurs", async () => {
      await test.http
        .get(`/api/v1/trust/reports/${reportId}`)
        .set(alice.auth)
        .expect(404)
      await test.http
        .get("/api/v1/admin/trust/reports")
        .set(alice.auth)
        .expect(403)
    })

    it("une suspension confirmée passe par le workflow des annonces, sans révoquer les vérifications", async () => {
      const resolved = await test.http
        .post(`/api/v1/admin/trust/reports/${reportId}/resolve`)
        .set(moderator.auth)
        .send({
          outcome: "CONFIRMED",
          action: "LISTING_SUSPENDED",
          internalNote: SECRET_NOTE,
        })
        .expect(200)
      expect(resolved.body).toMatchObject({
        status: "CONFIRMED",
        action: "LISTING_SUSPENDED",
      })
      const status = await test.db.query<{ status: string }>(
        "SELECT status FROM listings WHERE public_id = $1",
        [listingId],
      )
      expect(status.rows[0]!.status).toBe("SUSPENDED")

      const own = await test.http
        .get(`/api/v1/trust/reports/${reportId}`)
        .set(stranger.auth)
        .expect(200)
      expect(own.body.status).toBe("RESOLVED")
      expect(JSON.stringify(own.body)).not.toContain(SECRET_NOTE)

      const identity = await getOwn(alice, identityId)
      expect(identity.body.status).toBe("VERIFIED")
      const notices = await notificationsOf(test, alice)
      expect(
        notices.some((notice) => notice.data.listingId === listingId),
      ).toBe(true)
      expect(JSON.stringify(notices)).not.toContain(SECRET_NOTE)
    })

    it("l'historique des signalements est en ajout seul", async () => {
      await expect(
        test.db.query(
          `DELETE FROM report_events
           WHERE report_id = (SELECT id FROM reports WHERE public_id = $1)`,
          [reportId],
        ),
      ).rejects.toThrow()
    })
  })

  describe("alertes de risque", () => {
    const signalFor = async (listingId: string) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const page = await test.http
          .get("/api/v1/admin/trust/signals?status=OPEN&limit=100")
          .set(officer.auth)
          .expect(200)
        const found = page.body.items.find(
          (signal: { ruleCode: string; details: { listingId?: string } }) =>
            signal.ruleCode === "PRICE_CHANGE_ANOMALY" &&
            signal.details.listingId === listingId,
        )
        if (found) return found as { id: string }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("alerte non levée")
    }

    const publishedWithPriceDrop = async (owner: TestUser) => {
      const property = await createProperty(test, owner)
      const id = await createListing(test, owner, property, "RENT", {
        amount: 300_000,
        period: "MONTH",
      })
      await test.http
        .post(`/api/v1/listings/${id}/publish`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await test.http
        .put(`/api/v1/listings/${id}/price`)
        .set(owner.auth)
        .send({ amount: 90_000, period: "MONTH" })
        .expect(200)
      return id
    }

    it("une forte baisse de prix ouvre une alerte, sans effet sur l'annonce", async () => {
      const listingId = await publishedWithPriceDrop(alice)
      const signal = await signalFor(listingId)
      const listing = await test.http
        .get(`/api/v1/listings/${listingId}`)
        .expect(200)
      expect(listing.body.status).toBe("PUBLISHED")

      const reviewed = await test.http
        .post(`/api/v1/admin/trust/signals/${signal.id}/review`)
        .set(officer.auth)
        .send({ outcome: "DISMISSED", note: "Baisse justifiée." })
        .expect(200)
      expect(reviewed.body.status).toBe("DISMISSED")
      const again = await test.http
        .post(`/api/v1/admin/trust/signals/${signal.id}/review`)
        .set(officer.auth)
        .send({ outcome: "CONFIRMED" })
        .expect(409)
      expect(again.body.code).toBe("SIGNAL_ALREADY_REVIEWED")
    })

    it("un relecteur n'examine pas une alerte qui le concerne", async () => {
      const ownerOfficer = await userWithRoles(test, ["OWNER", "TRUST_OFFICER"])
      const signal = await signalFor(await publishedWithPriceDrop(ownerOfficer))
      const refused = await test.http
        .post(`/api/v1/admin/trust/signals/${signal.id}/review`)
        .set(ownerOfficer.auth)
        .send({ outcome: "DISMISSED" })
        .expect(403)
      expect(refused.body.code).toBe("CONFLICT_OF_INTEREST")
      await test.http
        .get("/api/v1/admin/trust/signals")
        .set(alice.auth)
        .expect(403)
    })
  })

  describe("score interne", () => {
    it("est réservé aux agents habilités, audité, et jamais pour soi-même", async () => {
      const score = await test.http
        .get(`/api/v1/admin/trust/users/${alice.userId}/score`)
        .set(officer.auth)
        .expect(200)
      expect(score.body.isComplete).toBe(true)
      expect(typeof score.body.score).toBe("number")
      await test.http
        .get(`/api/v1/admin/trust/users/${alice.userId}/score`)
        .set(moderator.auth)
        .expect(403)
      await test.http
        .get(`/api/v1/admin/trust/users/${officer.userId}/score`)
        .set(officer.auth)
        .expect(403)
      const actions = (await auditActions(test, alice.userId)).map(
        (entry) => entry.action,
      )
      expect(actions).toContain("TRUST_SCORE_VIEWED")
    })

    it("un compte nouveau n'est pas noté, faute de données", async () => {
      const newcomer = await userWithRoles(test, ["CUSTOMER"])
      const score = await test.http
        .get(`/api/v1/admin/trust/users/${newcomer.userId}/score`)
        .set(officer.auth)
        .expect(200)
      expect(score.body).toMatchObject({ score: null, isComplete: false })
    })
  })

  describe("révocation, expiration, rétention", () => {
    it("révoque avec un motif obligatoire et retire le badge", async () => {
      const subject = await userWithRoles(test, ["OWNER"])
      const id = await verifiedIdentity(test, subject, officer)
      expect(await userBadges(subject)).toContain("IDENTITY_VERIFIED")
      await review(test, officer, id, "revoke", {}, 400)
      const revoked = await review(test, officer, id, "revoke", {
        reasonCode: "NEW_EVIDENCE",
        internalNote: SECRET_NOTE,
      })
      expect(revoked.body.status).toBe("REVOKED")
      expect(await userBadges(subject)).not.toContain("IDENTITY_VERIFIED")
      const notices = await notificationsOf(test, subject)
      expect(notices[0]!.body).toContain("nouveaux éléments")
      expect(JSON.stringify(notices)).not.toContain(SECRET_NOTE)
    })

    it("expire les vérifications échues puis retire les pièces après la rétention", async () => {
      const subject = await userWithRoles(test, ["OWNER"])
      const id = await verifiedIdentity(test, subject, officer)
      const maintenance = test.app.get(TrustMaintenanceService)
      const later = new Date(Date.now() + 3 * 365 * DAY)

      expect(await maintenance.expireDue(later)).toBeGreaterThanOrEqual(1)
      const expired = await getOwn(subject, id)
      expect(expired.body.status).toBe("EXPIRED")
      expect(await userBadges(subject)).not.toContain("IDENTITY_VERIFIED")

      expect(await maintenance.retireDocuments(later)).toBeGreaterThanOrEqual(1)
      const media = await test.db.query<{
        status: string
        deleted_at: Date | null
      }>(
        `SELECT d.status, m.deleted_at FROM verification_documents d
         JOIN verifications v ON v.id = d.verification_id
         JOIN media m ON m.id = d.media_id WHERE v.public_id = $1`,
        [id],
      )
      for (const row of media.rows) {
        expect(row.status).toBe("REMOVED")
        expect(row.deleted_at).not.toBeNull()
      }
      const actions = (await auditActions(test, id)).map(
        (entry) => entry.action,
      )
      expect(actions).toContain("VERIFICATION_EXPIRED")
    })
  })

  describe("notifications", () => {
    it("se marquent comme lues par leur seul destinataire", async () => {
      const [notice] = await notificationsOf(test, alice)
      await test.http
        .post(`/api/v1/notifications/${notice!.id}/read`)
        .set(stranger.auth)
        .expect(404)
      const read = await test.http
        .post(`/api/v1/notifications/${notice!.id}/read`)
        .set(alice.auth)
        .expect(200)
      expect(read.body.readAt).not.toBeNull()
      const all = await test.http
        .post("/api/v1/notifications/read-all")
        .set(alice.auth)
        .expect(200)
      expect(all.body.updated).toBeGreaterThanOrEqual(0)
      await test.http.get("/api/v1/notifications").expect(401)
    })
  })
})
