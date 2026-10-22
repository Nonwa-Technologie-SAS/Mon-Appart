import { randomUUID } from "node:crypto"
import { rm, stat, utimes } from "node:fs/promises"
import { join } from "node:path"

import { EventEmitter2 } from "@nestjs/event-emitter"
import sharp from "sharp"

import { MediaCleanupService, MediaJobRunner } from "../../src/modules/media"
import { MediaProcessingService } from "../../src/modules/media/application/media-processing.service"
import { MediaRepository } from "../../src/modules/media/infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../../src/modules/media/infrastructure/storage/object-storage"
import { MediaConfig } from "../../src/modules/media/media.config"
import { SearchIndexer } from "../../src/modules/search"
import { image, mp4, pdf } from "../../src/modules/media/testing/media-fixtures"
import {
  auditActions,
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import {
  createIdentityApp,
  type IdentityTestApp,
} from "../identity/identity-app"
import {
  complete,
  mediaRow,
  openSession,
  pathOf,
  putFile,
  uploadMedia,
  type Session,
} from "./media-app"

describe("Media : envoi, traitement, exposition", () => {
  let test: IdentityTestApp
  let owner: TestUser
  let stranger: TestUser
  let moderator: TestUser
  let propertyId: string
  let runner: MediaJobRunner
  let storage: ObjectStorage
  let config: MediaConfig
  let jpeg: Buffer

  beforeAll(async () => {
    test = await createIdentityApp()
    owner = await userWithRoles(test, ["OWNER"])
    stranger = await userWithRoles(test, ["OWNER"])
    moderator = await userWithRoles(test, ["MODERATOR"])
    propertyId = await createProperty(test, owner)
    runner = test.app.get(MediaJobRunner)
    storage = test.app.get<ObjectStorage>(OBJECT_STORAGE)
    config = test.app.get(MediaConfig)
    jpeg = await image({ width: 1600, height: 1200, withExif: true })
  })

  afterAll(async () => {
    await test.close()
    await rm(config.local.root, { recursive: true, force: true })
  })

  const listMedia = (id: string, user?: TestUser) => {
    const request = test.http.get(`/api/v1/properties/${id}/media`)
    return user ? request.set(user.auth) : request
  }

  describe("session d'envoi et confirmation", () => {
    it("traite une photo de bout en bout sans jamais exposer la clé de stockage", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: jpeg.length,
        filename: "../../salon.jpg",
      })
      const session = opened.body as Session
      expect(session).toMatchObject({
        status: "PENDING_UPLOAD",
        upload: {
          method: "PUT",
          contentLength: jpeg.length,
          headers: { "Content-Type": "image/jpeg" },
        },
      })
      const row = await mediaRow(test, session.mediaId)
      expect(JSON.stringify(opened.body)).not.toContain(row.storage_key)
      expect(row.storage_key).toMatch(
        new RegExp(`^o/${session.mediaId}/[0-9a-f]{32}\\.jpg$`),
      )

      await putFile(test, session.upload!, jpeg).expect(200)
      const confirmed = await complete(test, owner, session.sessionId).expect(
        200,
      )
      expect(confirmed.body.status).toBe("UPLOADED")
      // Idempotent : même réponse, aucun nouvel effet.
      const again = await complete(test, owner, session.sessionId).expect(200)
      expect(again.body.status).toBe("UPLOADED")

      await runner.runOnce()
      const ready = await test.http
        .get(`/api/v1/media/upload-sessions/${session.sessionId}`)
        .set(owner.auth)
        .expect(200)
      const media = ready.body.media
      expect(ready.body.status).toBe("READY")
      expect(
        media.variants.map((variant: { kind: string }) => variant.kind),
      ).toEqual(["THUMBNAIL", "CARD", "GALLERY", "LARGE"])
      expect(media).toMatchObject({
        width: 1600,
        height: 1200,
        originalFilename: "salon.jpg",
      })
      expect(media.url).toBe(
        `http://media.test/api/v1/media/local/public/${session.mediaId}/card.webp`,
      )

      const served = await test.http
        .get(pathOf(media.url))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = []
          response.on("data", (chunk: Buffer) => chunks.push(chunk))
          response.on("end", () => callback(null, Buffer.concat(chunks)))
        })
        .expect(200)
      expect(served.headers["content-type"]).toBe("image/webp")
      expect(served.headers["x-content-type-options"]).toBe("nosniff")
      const metadata = await sharp(served.body as Buffer).metadata()
      expect(metadata).toMatchObject({
        format: "webp",
        width: 640,
        height: 480,
      })
      expect(metadata.exif).toBeUndefined()

      const property = await test.http
        .get(`/api/v1/properties/${propertyId}`)
        .expect(200)
      expect(property.body.media).toEqual({ count: 1, coverUrl: media.url })

      const publicList = await listMedia(propertyId).expect(200)
      expect(publicList.body.items).toHaveLength(1)
      expect(publicList.body.items[0]).toMatchObject({
        id: session.mediaId,
        isPrimary: true,
      })
      expect(publicList.body.items[0]).not.toHaveProperty("originalFilename")
    })

    it("laisse la session ouverte si le fichier n'a pas été reçu", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: jpeg.length,
      })
      const response = await complete(
        test,
        owner,
        opened.body.sessionId,
      ).expect(409)
      expect(response.body.code).toBe("UPLOAD_NOT_RECEIVED")
      expect((await mediaRow(test, opened.body.mediaId)).status).toBe(
        "PENDING_UPLOAD",
      )
    })

    it("refuse un fichier dont le contenu ne correspond pas au type annoncé", async () => {
      const fake = Buffer.concat([pdf(), Buffer.alloc(200)])
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: fake.length,
        filename: "photo.jpg",
      })
      await putFile(test, opened.body.upload, fake).expect(200)
      const response = await complete(
        test,
        owner,
        opened.body.sessionId,
      ).expect(422)
      expect(response.body.code).toBe("UPLOAD_CONTENT_MISMATCH")
      const row = await mediaRow(test, opened.body.mediaId)
      expect(row).toMatchObject({
        status: "REJECTED",
        processing_error: "CONTENT_MISMATCH",
      })
      expect(row.deleted_at).not.toBeNull()
      const again = await complete(test, owner, opened.body.sessionId).expect(
        200,
      )
      expect(again.body.status).toBe("REJECTED")
    })

    it("revérifie la taille réelle de l'objet stocké", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: jpeg.length,
      })
      const row = await mediaRow(test, opened.body.mediaId)
      // Objet déposé hors du lien signé, d'une autre taille (fournisseur non conforme).
      await storage.write("private", row.storage_key, jpeg.subarray(0, 1_000), {
        contentType: "image/jpeg",
      })
      const response = await complete(
        test,
        owner,
        opened.body.sessionId,
      ).expect(422)
      expect(response.body.code).toBe("UPLOAD_SIZE_MISMATCH")
      expect((await mediaRow(test, opened.body.mediaId)).status).toBe(
        "REJECTED",
      )
    })

    it.each([
      [
        "SVG",
        { type: "IMAGE", mimeType: "image/svg+xml", size: 100 },
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      ],
      [
        "extension trompeuse",
        {
          type: "IMAGE",
          mimeType: "image/jpeg",
          size: 100,
          filename: "shell.php",
        },
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      ],
      [
        "image trop lourde",
        { type: "IMAGE", mimeType: "image/jpeg", size: 16 * 1024 * 1024 },
        413,
        "FILE_TOO_LARGE",
      ],
      [
        "vidéo en document",
        { type: "DOCUMENT", mimeType: "video/mp4", size: 100 },
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      ],
    ] as const)(
      "refuse la déclaration : %s",
      async (_name, body, status, code) => {
        const response = await openSession(
          test,
          owner,
          propertyId,
          body,
          status,
        )
        expect(response.body.code).toBe(code)
      },
    )

    it("refuse une clé ou un chemin imposés par le client", async () => {
      await test.http
        .post("/api/v1/media/upload-sessions")
        .set(owner.auth)
        .send({
          propertyId,
          type: "IMAGE",
          mimeType: "image/jpeg",
          size: 10,
          storageKey: "o/../../etc/passwd",
        })
        .expect(400)
    })

    it("n'accepte qu'un seul envoi par lien, et aucun lien altéré", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: jpeg.length,
      })
      await putFile(test, opened.body.upload, jpeg).expect(200)
      const reused = await putFile(test, opened.body.upload, jpeg).expect(412)
      expect(reused.body.code).toBe("UPLOAD_ALREADY_RECEIVED")

      const tampered = {
        ...opened.body.upload,
        url: `${opened.body.upload.url}x`,
      }
      await putFile(test, tampered, jpeg).expect(403)
      const wrongType = {
        ...opened.body.upload,
        headers: { "Content-Type": "text/html" },
      }
      await putFile(test, wrongType, jpeg).expect(422)
    })

    it("expire une session confirmée trop tard", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: jpeg.length,
      })
      await test.db.query(
        "UPDATE media SET upload_expires_at = now() - interval '1 hour' WHERE public_id = $1",
        [opened.body.mediaId],
      )
      const response = await complete(
        test,
        owner,
        opened.body.sessionId,
      ).expect(410)
      expect(response.body.code).toBe("UPLOAD_SESSION_EXPIRED")
      expect(await mediaRow(test, opened.body.mediaId)).toMatchObject({
        status: "FAILED",
        processing_error: "UPLOAD_EXPIRED",
      })
    })

    it("limite le nombre de médias par bien", async () => {
      const property = await createProperty(test, owner)
      const previous = config.limits.perProperty
      config.limits.perProperty = 1
      try {
        await openSession(test, owner, property, {
          type: "IMAGE",
          mimeType: "image/png",
          size: 10,
        })
        const response = await openSession(
          test,
          owner,
          property,
          { type: "IMAGE", mimeType: "image/png", size: 10 },
          409,
        )
        expect(response.body.code).toBe("MEDIA_LIMIT_REACHED")
      } finally {
        config.limits.perProperty = previous
      }
    })
  })

  describe("autorisations", () => {
    it("exige une authentification", async () => {
      await test.http
        .post("/api/v1/media/upload-sessions")
        .send({ propertyId, type: "IMAGE", mimeType: "image/jpeg", size: 10 })
        .expect(401)
    })

    it("refuse l'envoi sur le bien d'un autre et masque ses sessions", async () => {
      const denied = await openSession(
        test,
        stranger,
        propertyId,
        { type: "IMAGE", mimeType: "image/jpeg", size: 10 },
        403,
      )
      expect(denied.body.code).toBe("PROPERTY_ACCESS_DENIED")

      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: 10,
      })
      await test.http
        .get(`/api/v1/media/upload-sessions/${opened.body.sessionId}`)
        .set(stranger.auth)
        .expect(404)
      await complete(test, stranger, opened.body.sessionId).expect(404)
    })

    it("ne laisse pas un autre utilisateur réordonner ou supprimer", async () => {
      const list = await listMedia(propertyId, owner).expect(200)
      const ids = list.body.items.map((item: { id: string }) => item.id)
      await test.http
        .patch(`/api/v1/properties/${propertyId}/media/order`)
        .set(stranger.auth)
        .send({ mediaIds: ids })
        .expect(403)
      await test.http
        .delete(`/api/v1/properties/${propertyId}/media/${ids[0]}`)
        .set(stranger.auth)
        .expect(403)
    })

    it("cache les médias d'un bien non publié au public", async () => {
      const draft = await createProperty(test, owner, undefined, false)
      await listMedia(draft).expect(404)
      await listMedia(draft, stranger).expect(404)
      await listMedia(draft, owner).expect(200)
    })
  })

  describe("documents privés", () => {
    let documentId: string

    it("garde un document privé, même demandé public, et ne l'expose jamais publiquement", async () => {
      const session = await uploadMedia(test, owner, propertyId, pdf(), {
        type: "DOCUMENT",
        mimeType: "application/pdf",
        filename: "titre-foncier.pdf",
        visibility: "PUBLIC",
      })
      documentId = session.mediaId
      expect(session.status).toBe("READY")
      expect(await mediaRow(test, documentId)).toMatchObject({
        visibility: "PRIVATE",
        url: null,
      })
      expect(
        (await mediaRow(test, documentId)).storage_key.startsWith("q/"),
      ).toBe(true)

      const publicList = await listMedia(propertyId).expect(200)
      expect(
        publicList.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(documentId)
      const managerList = await listMedia(propertyId, owner).expect(200)
      const document = managerList.body.items.find(
        (item: { id: string }) => item.id === documentId,
      )
      expect(document).toMatchObject({
        type: "DOCUMENT",
        url: null,
        variants: [],
      })
    })

    it("ne délivre qu'un lien court, audité, au gestionnaire ou à la modération", async () => {
      const link = await test.http
        .get(`/api/v1/properties/${propertyId}/media/${documentId}/download`)
        .set(owner.auth)
        .expect(200)
      expect(new Date(link.body.expiresAt).getTime()).toBeLessThanOrEqual(
        Date.now() + config.downloadUrlTtlSeconds * 1_000 + 1_000,
      )
      const file = await test.http.get(pathOf(link.body.url)).expect(200)
      expect(file.headers["content-type"]).toBe("application/pdf")
      expect(file.headers["content-disposition"]).toMatch(/^attachment;/)
      expect(file.headers["cache-control"]).toBe("private, no-store")

      await test.http
        .get(`/api/v1/properties/${propertyId}/media/${documentId}/download`)
        .set(moderator.auth)
        .expect(200)
      await test.http
        .get(`/api/v1/properties/${propertyId}/media/${documentId}/download`)
        .set(stranger.auth)
        .expect(404)
      await test.http
        .get(`/api/v1/properties/${propertyId}/media/${documentId}/download`)
        .expect(401)

      const actions = (await auditActions(test, documentId)).map(
        (entry) => entry.action,
      )
      expect(
        actions.filter((action) => action === "MEDIA_DOCUMENT_ACCESSED"),
      ).toHaveLength(2)
    })

    it("refuse un PDF au contenu actif", async () => {
      const session = await uploadMedia(
        test,
        owner,
        propertyId,
        pdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"),
        { type: "DOCUMENT", mimeType: "application/pdf" },
      )
      expect(session).toMatchObject({
        status: "REJECTED",
        errorCode: "DOCUMENT_ACTIVE_CONTENT",
      })
    })
  })

  describe("vidéos", () => {
    it("publie une vidéo MP4 courte avec sa durée", async () => {
      const session = await uploadMedia(
        test,
        owner,
        propertyId,
        mp4({ durationSeconds: 20 }),
        {
          type: "VIDEO",
          mimeType: "video/mp4",
        },
      )
      expect(session.status).toBe("READY")
      expect(session.media!.variants.map((variant) => variant.kind)).toEqual([
        "PLAYBACK",
      ])
      expect(session.media!.url).toMatch(/\/playback\.mp4$/)
      await test.http.get(pathOf(session.media!.url!)).expect(200)
    })

    it.each([
      ["trop longue", mp4({ durationSeconds: 900 }), "VIDEO_TOO_LONG"],
      ["avec position GPS", mp4({ withLocation: true }), "VIDEO_HAS_LOCATION"],
    ])("refuse une vidéo %s", async (_name, bytes, code) => {
      const session = await uploadMedia(test, owner, propertyId, bytes, {
        type: "VIDEO",
        mimeType: "video/mp4",
      })
      expect(session).toMatchObject({ status: "REJECTED", errorCode: code })
    })
  })

  describe("ordre, image principale, suppression", () => {
    let property: string
    let listing: string
    let otherListing: string
    let first: Session
    let second: Session

    const indexState = async (listingId: string) => {
      const result = await test.db.query<{
        indexed_at: Date
        quality_score: number
      }>(
        `SELECT d.indexed_at, d.quality_score FROM listing_search_documents d
         JOIN listings l ON l.id = d.listing_id WHERE l.public_id = $1`,
        [listingId],
      )
      return result.rows[0]
    }

    const waitFor = async (condition: () => Promise<boolean>) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await condition()) return
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("condition non atteinte")
    }

    const publishedListing = async (propertyPublicId: string) => {
      const id = await createListing(test, owner, propertyPublicId, "RENT", {
        amount: 300_000,
        period: "MONTH",
      })
      await test.http
        .post(`/api/v1/listings/${id}/publish`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await test.app.get(SearchIndexer).syncListing(id)
      expect(await indexState(id)).toBeDefined()
      return id
    }

    beforeAll(async () => {
      property = await createProperty(test, owner)
      listing = await publishedListing(property)
      otherListing = await publishedListing(await createProperty(test, owner))
    })

    it("abonne Search et Recommendation à chaque événement, un par un", () => {
      const emitter = test.app.get(EventEmitter2)
      for (const name of [
        "property.media_changed",
        "listing.published",
        "property.updated",
      ]) {
        expect(emitter.listeners(name).length).toBeGreaterThanOrEqual(2)
      }
      expect(
        emitter.eventNames().some((name) => String(name).includes(",")),
      ).toBe(false)
    })

    it("réindexe uniquement les annonces du bien quand une photo devient prête", async () => {
      const before = await indexState(listing)
      const unrelated = await indexState(otherListing)
      first = await uploadMedia(
        test,
        owner,
        property,
        await image({ format: "png" }),
        {
          type: "IMAGE",
          mimeType: "image/png",
        },
      )
      second = await uploadMedia(
        test,
        owner,
        property,
        await image({ format: "webp" }),
        {
          type: "IMAGE",
          mimeType: "image/webp",
        },
      )
      await waitFor(
        async () =>
          (await indexState(listing))!.quality_score > before!.quality_score,
      )
      expect(await indexState(otherListing)).toEqual(unrelated)
      const detail = await test.http
        .get(`/api/v1/listings/${listing}`)
        .expect(200)
      expect(detail.body.media).toEqual({
        count: 2,
        coverUrl: first.media!.url,
      })
    })

    it("change l'image principale sans réindexation globale", async () => {
      const before = await indexState(listing)
      const unrelated = await indexState(otherListing)
      const response = await test.http
        .patch(`/api/v1/properties/${property}/media/${second.mediaId}`)
        .set(owner.auth)
        .send({ isPrimary: true })
        .expect(200)
      expect(response.body).toMatchObject({
        id: second.mediaId,
        isPrimary: true,
        sortOrder: 0,
      })
      await waitFor(
        async () =>
          (await indexState(listing))!.indexed_at > before!.indexed_at,
      )
      expect(await indexState(otherListing)).toEqual(unrelated)

      const detail = await test.http
        .get(`/api/v1/properties/${property}`)
        .expect(200)
      expect(detail.body.media.coverUrl).toBe(second.media!.url)
      const actions = (await auditActions(test, second.mediaId)).map(
        (entry) => entry.action,
      )
      expect(actions).toContain("MEDIA_PRIMARY_CHANGED")
    })

    it("refuse une vidéo ou un média inexistant comme image principale", async () => {
      const video = await uploadMedia(test, owner, property, mp4(), {
        type: "VIDEO",
        mimeType: "video/mp4",
      })
      const refused = await test.http
        .patch(`/api/v1/properties/${property}/media/${video.mediaId}`)
        .set(owner.auth)
        .send({ isPrimary: true })
        .expect(422)
      expect(refused.body.code).toBe("MEDIA_NOT_PRIMARY_ELIGIBLE")
      await test.http
        .patch(`/api/v1/properties/${property}/media/${randomUUID()}`)
        .set(owner.auth)
        .send({ isPrimary: true })
        .expect(404)
      await test.http
        .patch(`/api/v1/properties/${property}/media/${video.mediaId}`)
        .set(owner.auth)
        .send({ isPrimary: false })
        .expect(400)
    })

    it("réordonne avec la liste exacte des médias", async () => {
      const list = await listMedia(property, owner).expect(200)
      const ids: string[] = list.body.items.map(
        (item: { id: string }) => item.id,
      )
      const incomplete = await test.http
        .patch(`/api/v1/properties/${property}/media/order`)
        .set(owner.auth)
        .send({ mediaIds: ids.slice(1) })
        .expect(422)
      expect(incomplete.body.code).toBe("INVALID_MEDIA_ORDER")
      await test.http
        .patch(`/api/v1/properties/${property}/media/order`)
        .set(owner.auth)
        .send({ mediaIds: [ids[0], ids[0], ...ids.slice(2)] })
        .expect(422)

      const reversed = [...ids].reverse()
      const reordered = await test.http
        .patch(`/api/v1/properties/${property}/media/order`)
        .set(owner.auth)
        .send({ mediaIds: reversed })
        .expect(200)
      expect(
        reordered.body.items.map((item: { id: string }) => item.id),
      ).toEqual(reversed)
      const primary = reordered.body.items.find(
        (item: { isPrimary: boolean }) => item.isPrimary,
      )
      expect(primary.type).toBe("IMAGE")
    })

    it("masque immédiatement un média supprimé et retire ses variantes publiques", async () => {
      const cardUrl = first.media!.url!
      await test.http.get(pathOf(cardUrl)).expect(200)
      await test.http
        .delete(`/api/v1/properties/${property}/media/${first.mediaId}`)
        .set(owner.auth)
        .expect(204)

      const publicList = await listMedia(property).expect(200)
      expect(
        publicList.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(first.mediaId)
      await test.http.get(pathOf(cardUrl)).expect(404)
      const row = await mediaRow(test, first.mediaId)
      expect(row.deleted_at).not.toBeNull()
      expect(row.purge_after!.getTime()).toBeGreaterThan(
        Date.now() + 86_400_000,
      )
      expect(await storage.head("private", row.storage_key)).not.toBeNull()
      await test.http
        .delete(`/api/v1/properties/${property}/media/${first.mediaId}`)
        .set(owner.auth)
        .expect(404)
      const actions = (await auditActions(test, first.mediaId)).map(
        (entry) => entry.action,
      )
      expect(actions).toContain("MEDIA_DELETED")
    })
  })

  describe("file de traitement", () => {
    const uploaded = async () => {
      const bytes = await image({ format: "png", width: 300, height: 200 })
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/png",
        size: bytes.length,
      })
      await putFile(test, opened.body.upload, bytes).expect(200)
      await complete(test, owner, opened.body.sessionId).expect(200)
      const row = await test.db.query<{ id: string }>(
        "SELECT id FROM media WHERE public_id = $1",
        [opened.body.mediaId],
      )
      return {
        mediaId: opened.body.mediaId as string,
        id: BigInt(row.rows[0]!.id),
      }
    }

    it("retente une erreur transitoire avec délai, puis abandonne après le maximum d'essais", async () => {
      const { mediaId } = await uploaded()
      const key = (await mediaRow(test, mediaId)).storage_key
      // Original momentanément illisible (stockage indisponible).
      const original = join(config.local.root, "private", ...key.split("/"))
      const saved = await storage.read("private", key, 10_000_000)
      await rm(original)

      await runner.runOnce()
      const retried = await mediaRow(test, mediaId)
      expect(retried).toMatchObject({
        status: "UPLOADED",
        processing_attempts: 1,
        processing_error: "PROCESSING_ERROR",
      })
      expect(retried.next_attempt_at!.getTime()).toBeGreaterThan(
        Date.now() + 20_000,
      )

      // Le travail n'est pas repris avant son échéance.
      await runner.runOnce()
      expect((await mediaRow(test, mediaId)).processing_attempts).toBe(1)

      await test.db.query(
        "UPDATE media SET next_attempt_at = now(), processing_attempts = $2 WHERE public_id = $1",
        [mediaId, config.worker.maxAttempts - 1],
      )
      await runner.runOnce()
      const failed = await mediaRow(test, mediaId)
      expect(failed).toMatchObject({
        status: "FAILED",
        processing_error: "PROCESSING_ERROR",
      })
      expect(failed.deleted_at).not.toBeNull()
      await storage.write("private", key, saved, { contentType: "image/png" })
    })

    it("reprend un travail dont le bail a expiré et ignore le worker évincé", async () => {
      const { mediaId, id } = await uploaded()
      const repository = test.app.get(MediaRepository)
      const processing = test.app.get(MediaProcessingService)
      await test.db.query(
        "UPDATE media SET next_attempt_at = now() - interval '1 day' WHERE public_id = $1",
        [mediaId],
      )
      const [stale] = await repository.claimJobs(1, 60)
      expect(stale).toEqual({ id, attempt: 1 })
      // Worker arrêté : le bail expire, un autre worker reprend le travail.
      await test.db.query(
        "UPDATE media SET next_attempt_at = now() - interval '1 second' WHERE public_id = $1",
        [mediaId],
      )
      const [current] = await repository.claimJobs(1, 60)
      expect(current).toEqual({ id, attempt: 2 })

      expect(await processing.run(stale!)).toBe("LOST")
      expect((await mediaRow(test, mediaId)).status).toBe("PROCESSING")
      expect(await processing.run(current!)).toBe("READY")
      expect((await mediaRow(test, mediaId)).status).toBe("READY")
    })
  })

  describe("nettoyage", () => {
    it("expire les sessions abandonnées", async () => {
      const opened = await openSession(test, owner, propertyId, {
        type: "IMAGE",
        mimeType: "image/png",
        size: 10,
      })
      await test.db.query(
        "UPDATE media SET upload_expires_at = now() - interval '1 hour' WHERE public_id = $1",
        [opened.body.mediaId],
      )
      expect(
        await test.app.get(MediaCleanupService).expireSessions(),
      ).toBeGreaterThanOrEqual(1)
      expect(await mediaRow(test, opened.body.mediaId)).toMatchObject({
        status: "FAILED",
        processing_error: "UPLOAD_EXPIRED",
      })
    })

    it("purge après la rétention, sauf un justificatif cité par une vérification", async () => {
      const cleanup = test.app.get(MediaCleanupService)
      const purgeable = await uploadMedia(
        test,
        owner,
        propertyId,
        await image(),
        {
          type: "IMAGE",
          mimeType: "image/jpeg",
        },
      )
      const evidence = await uploadMedia(test, owner, propertyId, pdf(), {
        type: "DOCUMENT",
        mimeType: "application/pdf",
      })
      for (const session of [purgeable, evidence]) {
        await test.http
          .delete(`/api/v1/properties/${propertyId}/media/${session.mediaId}`)
          .set(owner.auth)
          .expect(204)
      }
      const evidenceKey = (await mediaRow(test, evidence.mediaId)).storage_key
      await test.db.query(
        `INSERT INTO verifications (user_id, property_id, type, document_reference)
         SELECT u.id, p.id, 'PROPERTY_OWNERSHIP', $3
         FROM users u, properties p WHERE u.public_id = $1 AND p.public_id = $2`,
        [owner.userId, propertyId, evidenceKey],
      )
      await test.db.query(
        "UPDATE media SET purge_after = now() - interval '1 minute' WHERE public_id = ANY($1::uuid[])",
        [[purgeable.mediaId, evidence.mediaId]],
      )

      await cleanup.purgeDue()

      const purged = await mediaRow(test, purgeable.mediaId)
      expect(purged.purged_at).not.toBeNull()
      expect(await storage.head("private", purged.storage_key)).toBeNull()
      const variants = await test.db.query(
        "SELECT 1 FROM media_variants v JOIN media m ON m.id = v.media_id WHERE m.public_id = $1",
        [purgeable.mediaId],
      )
      expect(variants.rowCount).toBe(0)

      const retained = await mediaRow(test, evidence.mediaId)
      expect(retained.purged_at).toBeNull()
      expect(retained.purge_after!.getTime()).toBeGreaterThan(
        Date.now() + 86_400_000,
      )
      expect(await storage.head("private", evidenceKey)).not.toBeNull()
    })

    it("détecte les objets orphelins en simulation avant toute suppression", async () => {
      const cleanup = test.app.get(MediaCleanupService)
      const orphanKey = `o/${randomUUID()}/${"a".repeat(32)}.jpg`
      const referencedKey = `q/${randomUUID()}/${"b".repeat(32)}.pdf`
      const recentKey = `o/${randomUUID()}/${"c".repeat(32)}.jpg`
      for (const key of [orphanKey, referencedKey, recentKey]) {
        await storage.write("private", key, Buffer.from("x"), {
          contentType: "image/jpeg",
        })
      }
      const old = new Date(Date.now() - 3 * 86_400_000)
      for (const key of [orphanKey, referencedKey]) {
        await utimes(
          join(config.local.root, "private", ...key.split("/")),
          old,
          old,
        )
      }
      await test.db.query(
        `INSERT INTO verifications (user_id, property_id, type, document_reference)
         SELECT u.id, p.id, 'PROPERTY_OWNERSHIP', $3
         FROM users u, properties p WHERE u.public_id = $1 AND p.public_id = $2`,
        [owner.userId, propertyId, referencedKey],
      )

      const dryRun = await cleanup.scanOrphans()
      expect(dryRun).toMatchObject({ dryRun: true, deleted: 0 })
      expect(dryRun.orphans).toBeGreaterThanOrEqual(2)
      expect(dryRun.retained).toBeGreaterThanOrEqual(1)
      expect(await storage.head("private", orphanKey)).not.toBeNull()

      const applied = await cleanup.scanOrphans(false)
      expect(applied.deleted).toBeGreaterThanOrEqual(1)
      expect(await storage.head("private", orphanKey)).toBeNull()
      expect(await storage.head("private", referencedKey)).not.toBeNull()
      expect(await storage.head("private", recentKey)).not.toBeNull()
      // Les médias vivants ne sont jamais touchés.
      const live = await listMedia(propertyId, owner).expect(200)
      for (const item of live.body.items as Array<{
        id: string
        type: string
      }>) {
        const row = await mediaRow(test, item.id)
        if (row.status === "READY") {
          expect(
            await stat(
              join(config.local.root, "private", ...row.storage_key.split("/")),
            ),
          ).toBeTruthy()
        }
      }
    })
  })
})
