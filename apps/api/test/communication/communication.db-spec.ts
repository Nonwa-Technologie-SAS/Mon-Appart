import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"

import { io, type Socket as ClientSocket } from "socket.io-client"

import { DeliveryRunner } from "../../src/modules/communication"
import { MediaConfig } from "../../src/modules/media/media.config"
import { image } from "../../src/modules/media/testing/media-fixtures"
import { MediaJobRunner } from "../../src/modules/media"
import {
  assign,
  createListing,
  createProperty,
  userWithRoles,
  type TestUser,
} from "../catalog/catalog-app"
import { pathOf } from "../media/media-app"
import {
  createCommunicationApp,
  deliveriesOf,
  makeDeliveriesDue,
  verifyContacts,
  type CommunicationTestApp,
} from "./communication-app"

const SECRET_BODY = "Mon code de portail est 4821, appelez-moi au 0700000000"
const HOUR = 3_600_000

describe("Communication : messagerie, notifications, visites", () => {
  let test: CommunicationTestApp
  let owner: TestUser
  let customer: TestUser
  let stranger: TestUser
  let agent: TestUser
  let moderator: TestUser
  let propertyId: string
  let listingId: string
  let conversationId: string
  let ownerEmail: string

  const runner = () => test.app.get(DeliveryRunner)

  const publishedListing = async (by: TestUser) => {
    const property = await createProperty(test, by)
    const id = await createListing(test, by, property, "RENT", {
      amount: 250_000,
      period: "MONTH",
    })
    await test.http
      .post(`/api/v1/listings/${id}/publish`)
      .set(by.auth)
      .send({})
      .expect(200)
    return { propertyId: property, listingId: id }
  }

  const start = (user: TestUser, body: Record<string, unknown>) =>
    test.http.post("/api/v1/conversations").set(user.auth).send(body)

  const send = (user: TestUser, id: string, body: Record<string, unknown>) =>
    test.http
      .post(`/api/v1/conversations/${id}/messages`)
      .set(user.auth)
      .send(body)

  const messages = async (user: TestUser, id: string, query = "") =>
    (
      await test.http
        .get(`/api/v1/conversations/${id}/messages${query}`)
        .set(user.auth)
        .expect(200)
    ).body as {
      items: Array<{
        id: string
        seq: number
        type: string
        body: string | null
        systemCode: string | null
        mine: boolean
        status: string | null
        attachments: Array<{ id: string; ready: boolean }>
      }>
      lastReadSeq: number
      lastSeq: number
    }

  const emailOf = async (user: TestUser) =>
    (
      await test.db.query<{ email: string }>(
        "SELECT email FROM users WHERE public_id = $1",
        [user.userId],
      )
    ).rows[0]!.email

  beforeAll(async () => {
    test = await createCommunicationApp({
      messaging: {
        maxConversationsPerHour: 3,
        maxMessagesPerMinute: 10,
        repeatLimit: 2,
        maxAttachments: 5,
        externalDelaySeconds: 300,
      },
      worker: {
        enabled: false,
        pollMs: 2_000,
        batchSize: 20,
        maxAttempts: 2,
        retryBaseSeconds: 1,
        providerTimeoutMs: 2_000,
      },
      fallbacks: new Map([["EMAIL", "SMS"]]),
      realtime: { enabled: true, revocationCheckMs: 200, eventRateLimit: 120 },
    })
    owner = await userWithRoles(test, ["OWNER"])
    customer = await userWithRoles(test, ["CUSTOMER"])
    stranger = await userWithRoles(test, ["CUSTOMER"])
    agent = await userWithRoles(test, ["AGENT"])
    moderator = await userWithRoles(test, ["MODERATOR"])
    await verifyContacts(test, owner.userId)
    await verifyContacts(test, customer.userId)
    ownerEmail = await emailOf(owner)
    ;({ propertyId, listingId } = await publishedListing(owner))
  })

  afterAll(async () => {
    const root = test.app.get(MediaConfig).local.root
    await test.close()
    await rm(root, { recursive: true, force: true })
  })

  describe("demande de contact et conversation", () => {
    it("exige une connexion", async () => {
      await test.http
        .post("/api/v1/conversations")
        .send({ listingId, message: "Bonjour" })
        .expect(401)
    })

    it("crée la conversation, sa demande de contact et le premier message", async () => {
      const clientMessageId = randomUUID()
      const created = await start(customer, {
        listingId,
        message: "Bonjour, le logement est-il disponible ?",
        clientMessageId,
      }).expect(201)
      expect(created.body).toMatchObject({
        created: true,
        conversation: { side: "REQUESTER", status: "OPEN", unread: 0 },
        message: { seq: 1, type: "TEXT", mine: true, status: "SENT" },
      })
      conversationId = created.body.conversation.id

      const replay = await start(customer, {
        listingId,
        message: "Bonjour, le logement est-il disponible ?",
        clientMessageId,
      }).expect(201)
      expect(replay.body.created).toBe(false)
      expect(replay.body.conversation.id).toBe(conversationId)
      expect(replay.body.message.id).toBe(created.body.message.id)
      expect((await messages(customer, conversationId)).lastSeq).toBe(1)

      const inquiry = await test.db.query<{ type: string; status: string }>(
        `SELECT i.type, i.status FROM inquiries i
         JOIN conversations c ON c.inquiry_id = i.id WHERE c.public_id = $1`,
        [conversationId],
      )
      expect(inquiry.rows).toEqual([{ type: "MESSAGE", status: "OPEN" }])
    })

    it("ne révèle aucune coordonnée des participants", async () => {
      const detail = await test.http
        .get(`/api/v1/conversations/${conversationId}`)
        .set(owner.auth)
        .expect(200)
      expect(detail.body).toMatchObject({ side: "LISTING_SIDE", unread: 1 })
      const json = JSON.stringify(detail.body)
      expect(json).not.toContain(ownerEmail)
      expect(json).not.toMatch(/"(email|phone)"/)
    })

    it("refuse l'auto-contact et les annonces non publiées", async () => {
      const own = await start(owner, { listingId, message: "Test" }).expect(422)
      expect(own.body.code).toBe("CANNOT_CONTACT_OWN_LISTING")
      const property = await createProperty(test, owner)
      const draft = await createListing(test, owner, property, "RENT", {
        amount: 100_000,
        period: "MONTH",
      })
      const hidden = await start(customer, {
        listingId: draft,
        message: "Bonjour",
      }).expect(404)
      expect(hidden.body.code).toBe("LISTING_NOT_FOUND")
    })

    it("un tiers ne voit rien, même avec l'identifiant de la conversation", async () => {
      await test.http
        .get(`/api/v1/conversations/${conversationId}`)
        .set(stranger.auth)
        .expect(404)
      await test.http
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set(stranger.auth)
        .expect(404)
      await send(stranger, conversationId, { body: "Intrusion" }).expect(404)
      await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(stranger.auth)
        .send({})
        .expect(404)
      const list = await test.http
        .get("/api/v1/conversations")
        .set(stranger.auth)
        .expect(200)
      expect(list.body.items).toEqual([])
    })

    it("refuse un expéditeur, un type ou un message système fournis par le client", async () => {
      await send(customer, conversationId, {
        body: "Bonjour",
        type: "SYSTEM",
      }).expect(400)
      await send(customer, conversationId, {
        body: "Bonjour",
        systemCode: "APPOINTMENT_CONFIRMED",
      }).expect(400)
      await send(customer, conversationId, {
        body: "Bonjour",
        authorId: owner.userId,
      }).expect(400)
      const empty = await send(customer, conversationId, {
        body: "   ",
      }).expect(422)
      expect(empty.body.code).toBe("MESSAGE_INVALID")
      await send(customer, conversationId, { body: "x".repeat(4001) }).expect(
        400,
      )
    })
  })

  describe("échanges, lecture et notifications", () => {
    it("le côté annonce répond ; la demande passe en cours de traitement", async () => {
      const reply = await send(owner, conversationId, {
        body: "Oui, il est disponible.",
      }).expect(201)
      expect(reply.body.message).toMatchObject({ seq: 2, mine: true })
      const inquiry = await test.db.query<{ status: string }>(
        `SELECT i.status FROM inquiries i
         JOIN conversations c ON c.inquiry_id = i.id WHERE c.public_id = $1`,
        [conversationId],
      )
      expect(inquiry.rows[0]!.status).toBe("IN_PROGRESS")
      const page = await messages(owner, conversationId)
      expect(page.lastReadSeq).toBe(2)
    })

    it("notifie sans le contenu du message et regroupe une série non lue", async () => {
      await send(customer, conversationId, { body: SECRET_BODY }).expect(201)
      await send(customer, conversationId, { body: "Merci !" }).expect(201)
      const notices = await test.http
        .get("/api/v1/notifications?unreadOnly=true")
        .set(owner.auth)
        .expect(200)
      const forConversation = notices.body.items.filter(
        (item: { data: { conversationId?: string } }) =>
          item.data.conversationId === conversationId,
      )
      expect(forConversation.length).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(notices.body)).not.toContain("4821")
      const count = await test.http
        .get("/api/v1/conversations/unread-count")
        .set(owner.auth)
        .expect(200)
      expect(count.body.unread).toBeGreaterThanOrEqual(2)
    })

    it("relaie par e-mail un message non lu, sans son contenu", async () => {
      test.email.reset()
      await makeDeliveriesDue(test)
      await runner().runOnce()
      const toOwner = test.email.sent.filter((mail) => mail.to === ownerEmail)
      expect(toOwner.length).toBeGreaterThanOrEqual(1)
      for (const mail of toOwner) {
        expect(JSON.stringify(mail.content)).not.toContain("4821")
        expect(mail.content.subject).toContain("Nouveau message")
      }
      const deliveries = await deliveriesOf(test, owner.userId)
      const email = deliveries.find(
        (row) => row.channel === "EMAIL" && row.category === "MESSAGES",
      )
      // Accepté par le fournisseur : SENT, jamais DELIVERED ni lu.
      expect(email).toMatchObject({ status: "SENT", provider: "fake-email" })
      expect(deliveries.some((row) => row.status === "DELIVERED")).toBe(false)
    })

    it("la lecture met à jour statuts, compteurs et notifications", async () => {
      const read = await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(owner.auth)
        .send({})
        .expect(200)
      expect(read.body.unread).toBe(0)
      const page = await messages(customer, conversationId)
      const mine = page.items.filter((item) => item.mine)
      expect(mine.every((item) => item.status === "READ")).toBe(true)
      const unread = await test.http
        .get("/api/v1/notifications/unread-count")
        .set(owner.auth)
        .expect(200)
      const notices = await test.http
        .get("/api/v1/notifications?unreadOnly=true")
        .set(owner.auth)
        .expect(200)
      expect(
        notices.body.items.some(
          (item: { data: { conversationId?: string } }) =>
            item.data.conversationId === conversationId,
        ),
      ).toBe(false)
      expect(unread.body.unread).toBe(notices.body.unread)
    })

    it("n'envoie plus d'e-mail pour un message lu avant l'échéance", async () => {
      test.email.reset()
      await send(customer, conversationId, {
        body: "Une autre question",
      }).expect(201)
      await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(owner.auth)
        .send({})
        .expect(200)
      await makeDeliveriesDue(test)
      await runner().runOnce()
      expect(test.email.sent.filter((mail) => mail.to === ownerEmail)).toEqual(
        [],
      )
      const cancelled = (await deliveriesOf(test, owner.userId)).filter(
        (row) => row.status === "CANCELLED" && row.last_error === "READ",
      )
      expect(cancelled.length).toBeGreaterThanOrEqual(1)
    })

    it("un échec d'e-mail n'affecte pas le message et ne dépasse pas les reprises prévues", async () => {
      test.email.reset()
      test.email.failFor(
        ownerEmail,
        { kind: "TEMPORARY", code: "SMTP_421" },
        { kind: "TEMPORARY", code: "SMTP_421" },
      )
      const sent = await send(customer, conversationId, {
        body: "Message pendant une panne",
      }).expect(201)
      await makeDeliveriesDue(test)
      expect((await runner().runOnce()).RETRY).toBeGreaterThanOrEqual(1)
      await makeDeliveriesDue(test)
      await runner().runOnce()
      const page = await messages(owner, conversationId)
      expect(page.items.some((item) => item.id === sent.body.message.id)).toBe(
        true,
      )
      const failed = (await deliveriesOf(test, owner.userId)).filter(
        (row) => row.channel === "EMAIL" && row.status === "FAILED",
      )
      expect(failed.at(-1)).toMatchObject({
        attempts: 2,
        last_error: "TEMPORARY:SMTP_421",
      })
      // MESSAGES n'autorise pas le SMS par défaut : aucun repli.
      expect(
        (await deliveriesOf(test, owner.userId)).some((row) => row.fallback),
      ).toBe(false)
      await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(owner.auth)
        .send({})
        .expect(200)
    })

    it("archive et désarchive à l'arrivée d'un nouveau message", async () => {
      await test.http
        .patch(`/api/v1/conversations/${conversationId}/archive`)
        .set(customer.auth)
        .send({ archived: true })
        .expect(200)
      const active = await test.http
        .get("/api/v1/conversations")
        .set(customer.auth)
        .expect(200)
      expect(
        active.body.items.some(
          (item: { id: string }) => item.id === conversationId,
        ),
      ).toBe(false)
      const archived = await test.http
        .get("/api/v1/conversations?archived=true")
        .set(customer.auth)
        .expect(200)
      expect(
        archived.body.items.some(
          (item: { id: string }) => item.id === conversationId,
        ),
      ).toBe(true)
      await send(owner, conversationId, {
        body: "Toujours intéressé ?",
      }).expect(201)
      const again = await test.http
        .get("/api/v1/conversations")
        .set(customer.auth)
        .expect(200)
      expect(
        again.body.items.some(
          (item: { id: string }) => item.id === conversationId,
        ),
      ).toBe(true)
    })

    it("rattrape les messages manqués par l'API REST (after=)", async () => {
      const page = await messages(customer, conversationId, "?after=3")
      expect(page.items.every((item) => item.seq > 3)).toBe(true)
      const seqs = page.items.map((item) => item.seq)
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    })
  })

  describe("pièces jointes", () => {
    it("n'accepte qu'un fichier privé prêt, envoyé par l'expéditeur pour cette conversation", async () => {
      const bytes = await image()
      const opened = await test.http
        .post(`/api/v1/conversations/${conversationId}/attachments`)
        .set(customer.auth)
        .send({ type: "IMAGE", mimeType: "image/jpeg", size: bytes.length })
        .expect(201)
      const { sessionId, mediaId, upload } = opened.body

      const early = await send(customer, conversationId, {
        attachmentIds: [mediaId],
      }).expect(422)
      expect(early.body.code).toBe("ATTACHMENT_INVALID")
      await send(owner, conversationId, { attachmentIds: [mediaId] }).expect(
        404,
      )

      await test.http
        .put(pathOf(upload.url))
        .set(upload.headers)
        .send(bytes)
        .expect(200)
      await test.http
        .post(`/api/v1/media/upload-sessions/${sessionId}/complete`)
        .set(customer.auth)
        .send({})
        .expect(200)
      await test.app.get(MediaJobRunner).runOnce()

      const sent = await send(customer, conversationId, {
        attachmentIds: [mediaId],
      }).expect(201)
      expect(sent.body.message).toMatchObject({ type: "IMAGE" })
      expect(sent.body.message.attachments).toEqual([
        expect.objectContaining({ id: mediaId, ready: true }),
      ])
      const row = await test.db.query<{ visibility: string }>(
        "SELECT visibility FROM media WHERE public_id = $1",
        [mediaId],
      )
      expect(row.rows[0]!.visibility).toBe("PRIVATE")

      const link = `/api/v1/conversations/${conversationId}/messages/${sent.body.message.id}/attachments/${mediaId}`
      await test.http.get(link).set(owner.auth).expect(200)
      await test.http.get(link).set(stranger.auth).expect(404)
      await send(customer, conversationId, { attachmentIds: [mediaId] }).expect(
        404,
      )
    })
  })

  describe("gestionnaires du bien", () => {
    it("un agent mandaté rejoint la conversation, puis la perd à la fin du mandat", async () => {
      await assign(test, propertyId, agent.userId, "AGENT")
      const visible = await test.http
        .get(`/api/v1/conversations/${conversationId}`)
        .set(agent.auth)
        .expect(200)
      expect(visible.body.side).toBe("LISTING_SIDE")

      await test.db.query(
        `UPDATE property_ownerships SET is_current = false, ended_at = now()
         WHERE property_id = (SELECT id FROM properties WHERE public_id = $1)
           AND owner_id = (SELECT id FROM users WHERE public_id = $2)`,
        [propertyId, agent.userId],
      )
      await test.http
        .get(`/api/v1/conversations/${conversationId}`)
        .set(agent.auth)
        .expect(404)
      await send(agent, conversationId, { body: "Encore là" }).expect(404)
      const participant = await test.db.query<{ state: string }>(
        `SELECT p.state FROM conversation_participants p
         JOIN conversations c ON c.id = p.conversation_id
         JOIN users u ON u.id = p.user_id
         WHERE c.public_id = $1 AND u.public_id = $2`,
        [conversationId, agent.userId],
      )
      expect(participant.rows[0]!.state).toBe("LEFT")
    })
  })

  describe("anti-spam", () => {
    it("refuse le message en cause sans bloquer le compte", async () => {
      const spammer = await userWithRoles(test, ["CUSTOMER"])
      const statusOf = async () =>
        (
          await test.db.query<{ status: string }>(
            "SELECT status FROM users WHERE public_id = $1",
            [spammer.userId],
          )
        ).rows[0]!.status
      const initialStatus = await statusOf()
      const targets = []
      for (let index = 0; index < 4; index++) {
        targets.push((await publishedListing(owner)).listingId)
      }
      const copy = "Bonjour, investissement garanti, écrivez-moi vite !"
      const first = await start(spammer, {
        listingId: targets[0],
        message: copy,
      }).expect(201)
      await start(spammer, { listingId: targets[1], message: copy }).expect(201)
      const repeated = await start(spammer, {
        listingId: targets[2],
        message: copy,
      }).expect(429)
      expect(repeated.body.code).toBe("MESSAGE_REPEATED")
      expect(repeated.headers["retry-after"]).toBe("3600")

      await start(spammer, {
        listingId: targets[2],
        message: "Une vraie question sur ce logement",
      }).expect(201)
      const tooMany = await start(spammer, {
        listingId: targets[3],
        message: "Bonjour",
      }).expect(429)
      expect(tooMany.body.code).toBe("CONVERSATION_RATE_LIMITED")

      const id = first.body.conversation.id
      for (let index = 0; index < 7; index++) {
        await send(spammer, id, { body: `ok ${index}` }).expect(201)
      }
      const flood = await send(spammer, id, { body: "encore" }).expect(429)
      expect(flood.body.code).toBe("MESSAGE_RATE_LIMITED")
      expect(flood.headers["retry-after"]).toBe("60")

      await test.http.get("/api/v1/conversations").set(spammer.auth).expect(200)
      expect(await statusOf()).toBe(initialStatus)
    })
  })

  describe("préférences et notifications", () => {
    it("expose la matrice et refuse de couper un canal verrouillé", async () => {
      const matrix = await test.http
        .get("/api/v1/notification-preferences")
        .set(owner.auth)
        .expect(200)
      expect(matrix.body.items).toContainEqual({
        category: "ACCOUNT",
        channel: "EMAIL",
        enabled: true,
        locked: true,
        available: true,
      })
      expect(matrix.body.items).toContainEqual(
        expect.objectContaining({
          category: "MESSAGES",
          channel: "PUSH",
          available: false,
        }),
      )
      const locked = await test.http
        .put("/api/v1/notification-preferences")
        .set(owner.auth)
        .send({
          items: [{ category: "ACCOUNT", channel: "EMAIL", enabled: false }],
        })
        .expect(422)
      expect(locked.body.code).toBe("PREFERENCE_LOCKED")
    })

    it("un canal coupé n'est plus planifié", async () => {
      await test.http
        .put("/api/v1/notification-preferences")
        .set(owner.auth)
        .send({
          items: [{ category: "MESSAGES", channel: "EMAIL", enabled: false }],
        })
        .expect(200)
      // Nouvelle série non lue : sinon la notification rejoint la précédente.
      await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(owner.auth)
        .send({})
        .expect(200)
      const before = (await deliveriesOf(test, owner.userId)).length
      await send(customer, conversationId, { body: "Après la coupure" }).expect(
        201,
      )
      const added = (await deliveriesOf(test, owner.userId)).slice(before)
      expect(added.map((row) => row.channel)).toEqual(["IN_APP"])
      await test.http
        .put("/api/v1/notification-preferences")
        .set(owner.auth)
        .send({
          items: [{ category: "MESSAGES", channel: "EMAIL", enabled: true }],
        })
        .expect(200)
      await test.http
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(owner.auth)
        .send({})
        .expect(200)
    })

    it("une notification d'autrui est introuvable ; tout lire est idempotent", async () => {
      const own = await test.http
        .get("/api/v1/notifications")
        .set(owner.auth)
        .expect(200)
      const id: string = own.body.items[0].id
      await test.http
        .patch(`/api/v1/notifications/${id}/read`)
        .set(stranger.auth)
        .expect(404)
      await test.http
        .patch(`/api/v1/notifications/${id}/read`)
        .set(owner.auth)
        .expect(200)
      await test.http
        .post("/api/v1/notifications/read-all")
        .set(owner.auth)
        .expect(200)
      const again = await test.http
        .post("/api/v1/notifications/read-all")
        .set(owner.auth)
        .expect(200)
      expect(again.body.updated).toBe(0)
    })

    it("enregistre un appareil push sans exposer ni journaliser le jeton", async () => {
      const token = `fcm-test-${randomUUID()}`
      const device = await test.http
        .post("/api/v1/push-devices")
        .set(customer.auth)
        .send({ token, platform: "ANDROID" })
        .expect(201)
      expect(JSON.stringify(device.body)).not.toContain(token)
      const audit = await test.db.query<{ new_values: unknown }>(
        `SELECT new_values FROM audit_logs WHERE action = 'PUSH_DEVICE_REGISTERED'
         ORDER BY created_at DESC LIMIT 1`,
      )
      expect(JSON.stringify(audit.rows)).not.toContain(token)
      await test.http
        .delete(`/api/v1/push-devices/${device.body.id}`)
        .set(stranger.auth)
        .expect(404)
      await test.http
        .delete(`/api/v1/push-devices/${device.body.id}`)
        .set(customer.auth)
        .expect(204)
    })
  })

  describe("visites", () => {
    let appointmentId: string
    const visitAt = () => new Date(Date.now() + 2 * HOUR).toISOString()

    const act = (
      user: TestUser,
      action: string,
      body: Record<string, unknown> = {},
      status = 200,
    ) =>
      test.http
        .post(`/api/v1/appointments/${appointmentId}/${action}`)
        .set(user.auth)
        .send(body)
        .expect(status)

    it("refuse un créneau trop proche ou un fuseau invalide", async () => {
      const soon = await test.http
        .post("/api/v1/appointments")
        .set(customer.auth)
        .send({
          listingId,
          scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        .expect(422)
      expect(soon.body.code).toBe("APPOINTMENT_TIME_INVALID")
      await test.http
        .post("/api/v1/appointments")
        .set(customer.auth)
        .send({ listingId, scheduledAt: visitAt(), timezone: "Mars/Olympus" })
        .expect(422)
    })

    it("une demande reste en attente, dans la conversation existante", async () => {
      const created = await test.http
        .post("/api/v1/appointments")
        .set(customer.auth)
        .send({
          listingId,
          scheduledAt: visitAt(),
          timezone: "Africa/Abidjan",
          notes: "Je viendrai avec ma sœur.",
        })
        .expect(201)
      appointmentId = created.body.id
      expect(created.body).toMatchObject({
        status: "PENDING",
        side: "REQUESTER",
        conversationId,
        confirmedAt: null,
        actions: ["RESCHEDULE", "CANCEL"],
      })
      const duplicate = await test.http
        .post("/api/v1/appointments")
        .set(customer.auth)
        .send({ listingId, scheduledAt: visitAt() })
        .expect(409)
      expect(duplicate.body.code).toBe("APPOINTMENT_ALREADY_ACTIVE")
      const page = await messages(owner, conversationId)
      expect(page.items.at(-1)).toMatchObject({
        type: "SYSTEM",
        systemCode: "APPOINTMENT_REQUESTED",
      })
      await test.http
        .get(`/api/v1/appointments/${appointmentId}`)
        .set(stranger.auth)
        .expect(404)
    })

    it("seul le côté annonce confirme ; une nouvelle date doit être acceptée par l'autre partie", async () => {
      await act(customer, "confirm", {}, 409)
      const proposed = await act(owner, "reschedule", {
        scheduledAt: new Date(Date.now() + 3 * HOUR).toISOString(),
      })
      expect(proposed.body).toMatchObject({
        status: "RESCHEDULE_REQUESTED",
        proposedBy: "LISTING_SIDE",
      })
      await act(owner, "confirm", {}, 409)
      const confirmed = await act(customer, "confirm")
      expect(confirmed.body.status).toBe("CONFIRMED")
      await act(customer, "complete", {}, 409)
    })

    it("relance par SMS en repli d'un e-mail refusé, sur un seul niveau", async () => {
      test.email.reset()
      test.sms.reset()
      const customerEmail = await emailOf(customer)
      const customerPhone = (
        await test.db.query<{ phone: string }>(
          "SELECT phone FROM users WHERE public_id = $1",
          [customer.userId],
        )
      ).rows[0]!.phone
      test.email.failFor(customerEmail, { kind: "RECIPIENT", code: "SMTP_550" })
      test.sms.failFor(customerPhone, { kind: "PERMANENT", code: "HTTP_418" })
      await test.db.query(
        "UPDATE notification_deliveries SET status = 'CANCELLED', next_attempt_at = NULL WHERE status = 'PENDING' AND channel <> 'IN_APP'",
      )
      expect(await runner().runReminders(true)).toBeGreaterThanOrEqual(1)
      await runner().runOnce()
      await runner().runOnce()
      const reminder = (await deliveriesOf(test, customer.userId)).filter(
        (row) => row.category === "APPOINTMENT_REMINDERS",
      )
      expect(reminder.find((row) => row.channel === "EMAIL")).toMatchObject({
        status: "FAILED",
        last_error: "RECIPIENT:SMTP_550",
      })
      expect(reminder.find((row) => row.channel === "SMS")).toMatchObject({
        status: "FAILED",
        fallback: true,
      })
      expect(reminder.filter((row) => row.fallback)).toHaveLength(1)
      expect(test.email.sent.some((mail) => mail.to === customerEmail)).toBe(
        true,
      )
      for (const sms of test.sms.sent) {
        expect(sms.text.length).toBeLessThanOrEqual(160)
        expect(sms.text).not.toContain("sœur")
      }
      expect(await runner().runReminders(true)).toBe(0)
    })

    it("terminée seulement après l'heure, par le côté annonce", async () => {
      await test.db.query(
        "UPDATE appointments SET scheduled_at = now() - interval '1 hour' WHERE public_id = $1",
        [appointmentId],
      )
      await act(customer, "complete", {}, 409)
      const done = await act(owner, "complete")
      expect(done.body).toMatchObject({ status: "COMPLETED", actions: [] })
      await act(owner, "cancel", {}, 409)
    })
  })

  describe("signalement et fermeture par la modération", () => {
    let reportId: string
    let ownerMessageId: string

    it("aucun accès global des modérateurs aux conversations", async () => {
      await test.http
        .get(`/api/v1/conversations/${conversationId}`)
        .set(moderator.auth)
        .expect(404)
    })

    it("un participant signale un message ; un tiers ne le peut pas", async () => {
      const page = await messages(customer, conversationId)
      ownerMessageId = page.items.find(
        (item) => !item.mine && item.type === "TEXT",
      )!.id
      await test.http
        .post(`/api/v1/conversations/${conversationId}/report`)
        .set(stranger.auth)
        .send({ reason: "INAPPROPRIATE_CONTENT" })
        .expect(404)
      const own = page.items.find((item) => item.mine && item.type === "TEXT")!
      await test.http
        .post(`/api/v1/conversations/${conversationId}/report`)
        .set(customer.auth)
        .send({ reason: "INAPPROPRIATE_CONTENT", messageId: own.id })
        .expect(422)
      const created = await test.http
        .post(`/api/v1/conversations/${conversationId}/report`)
        .set(customer.auth)
        .send({ reason: "INAPPROPRIATE_CONTENT", messageId: ownerMessageId })
        .expect(201)
      reportId = created.body.id
    })

    it("le modérateur voit un extrait limité au signalement, puis ferme la conversation", async () => {
      const detail = await test.http
        .get(`/api/v1/admin/trust/reports/${reportId}`)
        .set(moderator.auth)
        .expect(200)
      expect(detail.body.targetType).toBe("MESSAGE")
      expect(detail.body.conversationExcerpt).toEqual([
        expect.objectContaining({ id: ownerMessageId }),
      ])
      await test.http
        .post(`/api/v1/admin/trust/reports/${reportId}/resolve`)
        .set(moderator.auth)
        .send({ outcome: "CONFIRMED", action: "CONVERSATION_CLOSED" })
        .expect(200)
      const closed = await send(customer, conversationId, {
        body: "Encore un message",
      }).expect(409)
      expect(closed.body.code).toBe("CONVERSATION_CLOSED")
      const page = await messages(owner, conversationId)
      expect(page.items.at(-1)).toMatchObject({
        type: "SYSTEM",
        systemCode: "CONVERSATION_CLOSED",
      })
    })
  })

  describe("temps réel", () => {
    const sockets: ClientSocket[] = []
    let liveConversation: string

    const connect = (token?: string) =>
      new Promise<ClientSocket>((resolve, reject) => {
        const socket = io(`${test.baseUrl}/realtime`, {
          auth: token ? { token } : {},
          transports: ["websocket"],
          reconnection: false,
          forceNew: true,
        })
        sockets.push(socket)
        socket.once("connect", () => resolve(socket))
        socket.once("connect_error", (error) => reject(error))
      })

    const next = <T>(socket: ClientSocket, event: string, ms = 3_000) =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${event} non reçu`)),
          ms,
        )
        socket.once(event, (payload: T) => {
          clearTimeout(timer)
          resolve(payload)
        })
      })

    afterAll(() => {
      for (const socket of sockets) socket.close()
    })

    beforeAll(async () => {
      const listing = await publishedListing(owner)
      const created = await start(customer, {
        listingId: listing.listingId,
        message: "Bonjour pour la visite",
      }).expect(201)
      liveConversation = created.body.conversation.id
    })

    it("refuse une connexion sans jeton valide", async () => {
      await expect(connect()).rejects.toThrow("UNAUTHENTICATED")
      await expect(connect("jeton-invalide")).rejects.toThrow()
    })

    it("pousse les nouveaux messages au seul destinataire légitime", async () => {
      const customerSocket = await connect(customer.token)
      const strangerSocket = await connect(stranger.token)
      let leaked = false
      strangerSocket.on("message:new", () => {
        leaked = true
      })
      const received = next<{ message: { body: string; mine: boolean } }>(
        customerSocket,
        "message:new",
      )
      await send(owner, liveConversation, {
        body: "Visite possible demain",
      }).expect(201)
      const payload = await received
      expect(payload.message).toMatchObject({
        body: "Visite possible demain",
        mine: false,
      })
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(leaked).toBe(false)
    })

    it("accuse la lecture par socket, refusée hors conversation", async () => {
      const customerSocket = await connect(customer.token)
      const ack = await customerSocket.emitWithAck("conversation:read", {
        conversationId: liveConversation,
      })
      expect(ack).toMatchObject({ ok: true, unread: 0 })
      const strangerSocket = await connect(stranger.token)
      const refused = await strangerSocket.emitWithAck("conversation:read", {
        conversationId: liveConversation,
      })
      expect(refused).toEqual({ ok: false, code: "CONVERSATION_NOT_FOUND" })
      const invalid = await strangerSocket.emitWithAck("conversation:read", {
        conversationId: "pas-un-uuid",
      })
      expect(invalid).toEqual({ ok: false, code: "VALIDATION_FAILED" })
    })

    it("ferme le socket d'une session révoquée", async () => {
      const user = await userWithRoles(test, ["CUSTOMER"])
      const socket = await connect(user.token)
      const expired = next<{ code: string }>(socket, "session:expired")
      await test.http.post("/api/v1/auth/logout").set(user.auth).expect(204)
      expect((await expired).code).toBe("SESSION_REVOKED")
      await expect(connect(user.token)).rejects.toThrow()
    })
  })

  describe("CRM Inquiry (espace propriétaire)", () => {
    let otherOwner: TestUser
    let crmListingId: string
    let crmInquiryId: string

    beforeAll(async () => {
      otherOwner = await userWithRoles(test, ["OWNER"])
      const listing = await publishedListing(owner)
      crmListingId = listing.listingId
      const created = await start(customer, {
        listingId: crmListingId,
        message: "Le bien est-il encore libre ?",
      }).expect(201)
      const row = await test.db.query<{ public_id: string }>(
        `SELECT i.public_id FROM inquiries i
         JOIN conversations c ON c.inquiry_id = i.id
         WHERE c.public_id = $1`,
        [created.body.conversation.id],
      )
      crmInquiryId = row.rows[0]!.public_id
    })

    it("liste la demande au propriétaire, pas au prospect ni à un autre owner", async () => {
      const inbox = await test.http
        .get("/api/v1/inquiries")
        .set(owner.auth)
        .expect(200)
      expect(
        inbox.body.items.some(
          (item: { id: string }) => item.id === crmInquiryId,
        ),
      ).toBe(true)
      const asCustomer = await test.http
        .get("/api/v1/inquiries")
        .set(customer.auth)
        .expect(200)
      expect(
        asCustomer.body.items.some(
          (item: { id: string }) => item.id === crmInquiryId,
        ),
      ).toBe(false)
      await test.http
        .get(`/api/v1/inquiries/${crmInquiryId}`)
        .set(otherOwner.auth)
        .expect(404)
      await test.http
        .get(`/api/v1/inquiries/${crmInquiryId}`)
        .set(customer.auth)
        .expect(404)
    })

    it("refuse une conversion directe et une note au prospect", async () => {
      await test.http
        .patch(`/api/v1/inquiries/${crmInquiryId}`)
        .set(owner.auth)
        .send({ stage: "CONVERTED" })
        .expect(422)
      await test.http
        .patch(`/api/v1/inquiries/${crmInquiryId}`)
        .set(customer.auth)
        .send({ stage: "QUALIFIED" })
        .expect(404)
      const noted = await test.http
        .post(`/api/v1/inquiries/${crmInquiryId}/notes`)
        .set(owner.auth)
        .send({ body: "Relancer demain matin" })
        .expect(201)
      expect(noted.body.notes[0].body).toBe("Relancer demain matin")
      await test.http
        .post(`/api/v1/inquiries/${crmInquiryId}/notes`)
        .set(customer.auth)
        .send({ body: "Je lis vos notes" })
        .expect(404)
    })

    it("calcule un tableau de bord sans chiffres de démonstration", async () => {
      const dash = await test.http
        .get("/api/v1/inquiries/dashboard")
        .set(owner.auth)
        .expect(200)
      expect(dash.body.totals.inquiries).toBeGreaterThanOrEqual(1)
      expect(dash.body.windowDays).toBe(7)
      expect(Array.isArray(dash.body.topListings)).toBe(true)
    })
  })
})
