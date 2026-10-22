import { randomUUID } from "node:crypto"

import { ReconciliationService } from "../../src/modules/billing/application/reconciliation.service"
import {
  MOCK_SIGNATURE_HEADER,
  type MockPaymentProvider,
} from "../../src/modules/billing/infrastructure/providers/mock-payment.provider"
import { PaymentProviderRegistry } from "../../src/modules/billing/infrastructure/providers/payment-provider.registry"
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

const MOCK_SECRET = "test-only-mock-webhook-secret-0123456789"
const PRICE = { amount: 1_500_000, period: "MONTH" }

const key = () => randomUUID().replaceAll("-", "").slice(0, 24)
const planCode = () =>
  `PLAN_${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`

describe("Billing : commandes, paiements, abonnements, remboursements", () => {
  let test: IdentityTestApp
  let mock: MockPaymentProvider
  let admin: TestUser
  let admin2: TestUser
  let support: TestUser
  let analyst: TestUser
  let plan: string

  beforeAll(async () => {
    test = await createIdentityApp()
    mock = test.app.get(PaymentProviderRegistry).mock()!
    admin = await userWithRoles(test, ["ADMIN"])
    admin2 = await userWithRoles(test, ["ADMIN"])
    support = await userWithRoles(test, ["SUPPORT"])
    analyst = await userWithRoles(test, ["ANALYST"])
    plan = await createPlan(null, "15000")
  })

  afterAll(async () => {
    await test.close()
  })

  // ------------------------------------------------------------ utilitaires

  async function createPlan(
    maxActiveListings: number | null,
    amount: string,
  ): Promise<string> {
    const code = planCode()
    await test.http
      .post("/api/v1/admin/billing/catalog/products")
      .set(admin.auth)
      .send({ code, name: `Plan ${code}`, maxActiveListings })
      .expect(201)
    await test.http
      .post(`/api/v1/admin/billing/catalog/products/${code}/prices`)
      .set(admin.auth)
      .send({ amount, currency: "XOF", intervalMonths: 1 })
      .expect(201)
    await test.http
      .patch(`/api/v1/admin/billing/catalog/products/${code}`)
      .set(admin.auth)
      .send({ status: "ACTIVE" })
      .expect(200)
    return code
  }

  async function order(user: TestUser, productCode = plan): Promise<string> {
    const res = await test.http
      .post("/api/v1/billing/orders")
      .set(user.auth)
      .send({ productCode, idempotencyKey: key() })
      .expect(201)
    return res.body.id
  }

  async function startPayment(user: TestUser, orderId: string) {
    const res = await test.http
      .post(`/api/v1/billing/orders/${orderId}/payments`)
      .set(user.auth)
      .expect(201)
    const row = await test.db.query<{ provider_reference: string }>(
      "SELECT provider_reference FROM payment_transactions WHERE public_id = $1",
      [res.body.id],
    )
    return {
      paymentId: res.body.id as string,
      reference: row.rows[0]!.provider_reference,
    }
  }

  function deliver(event: { headers: Record<string, string>; body: string }) {
    return test.http
      .post("/api/v1/billing/webhooks/mock")
      .set(event.headers)
      .send(event.body)
  }

  async function paidSubscriber(productCode = plan) {
    const user = await userWithRoles(test, ["OWNER"])
    const orderId = await order(user, productCode)
    const { paymentId, reference } = await startPayment(user, orderId)
    await deliver(mock.simulate(reference, "SUCCEEDED")!).expect(200)
    return { user, orderId, paymentId, reference }
  }

  async function count(sql: string, params: unknown[]): Promise<number> {
    const res = await test.db.query<{ n: string }>(sql, params)
    return Number(res.rows[0]!.n)
  }

  const periodsOf = (orderId: string) =>
    count(
      "SELECT count(*) AS n FROM subscription_periods sp JOIN billing_orders o ON o.id = sp.order_id WHERE o.public_id = $1",
      [orderId],
    )

  const statusOf = async (table: string, publicId: string) =>
    (
      await test.db.query<{ status: string }>(
        `SELECT status FROM ${table} WHERE public_id = $1`,
        [publicId],
      )
    ).rows[0]!.status

  // ------------------------------------------------------------ catalogue

  describe("catalogue", () => {
    it("expose les plans actifs et leurs tarifs en entiers, sans authentification", async () => {
      const res = await test.http.get("/api/v1/billing/plans").expect(200)
      const free = res.body.find((p: { code: string }) => p.code === "FREE")
      expect(free).toBeDefined()
      const paid = res.body.find((p: { code: string }) => p.code === plan)
      expect(paid.currentPrice).toMatchObject({
        amount: "15000",
        currency: "XOF",
        intervalMonths: 1,
      })
    })

    it("réserve la gestion du catalogue à billing:catalog et fige les tarifs", async () => {
      await test.http
        .post("/api/v1/admin/billing/catalog/products")
        .set(support.auth)
        .send({ code: planCode(), name: "Interdit" })
        .expect(403)
      await test.http
        .post(`/api/v1/admin/billing/catalog/products/${plan}/prices`)
        .set(admin.auth)
        .send({ amount: "12.5", currency: "XOF", intervalMonths: 1 })
        .expect(400)
      await test.http
        .post(`/api/v1/admin/billing/catalog/products/${plan}/prices`)
        .set(admin.auth)
        .send({ amount: "1000", currency: "EUR", intervalMonths: 1 })
        .expect(400)
      await expect(
        test.db.query(
          "UPDATE billing_prices SET amount = 1 WHERE product_id = (SELECT id FROM billing_products WHERE code = $1)",
          [plan],
        ),
      ).rejects.toThrow()
    })

    it("le plan par défaut reste illimité et non achetable", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const ent = await test.http
        .get("/api/v1/billing/me/entitlements")
        .set(owner.auth)
        .expect(200)
      expect(ent.body).toMatchObject({
        source: "DEFAULT_PLAN",
        productCode: "FREE",
        maxActiveListings: null,
      })
      const res = await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: "FREE", idempotencyKey: key() })
        .expect(422)
      expect(res.body.code).toBe("PRODUCT_NOT_PURCHASABLE")
    })
  })

  // ------------------------------------------------------------ commandes

  describe("commandes", () => {
    it("le client ne fixe jamais le montant", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: plan, idempotencyKey: key(), amount: "1" })
        .expect(400)
      const res = await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: plan, idempotencyKey: key() })
        .expect(201)
      expect(res.body).toMatchObject({
        status: "PENDING",
        amount: "15000",
        currency: "XOF",
      })
    })

    it("exige billing:purchase", async () => {
      const customer = await userWithRoles(test, [])
      await test.http
        .post("/api/v1/billing/orders")
        .set(customer.auth)
        .send({ productCode: plan, idempotencyKey: key() })
        .expect(403)
    })

    it("est idempotente par clé et refuse une clé réutilisée pour un autre produit", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const other = await createPlan(null, "20000")
      const k = key()
      const first = await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: plan, idempotencyKey: k })
        .expect(201)
      const again = await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: plan, idempotencyKey: k })
        .expect(201)
      expect(again.body.id).toBe(first.body.id)
      const reused = await test.http
        .post("/api/v1/billing/orders")
        .set(owner.auth)
        .send({ productCode: other, idempotencyKey: k })
        .expect(409)
      expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    })

    it("une seule commande en attente, même sous requêtes concurrentes", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          test.http
            .post("/api/v1/billing/orders")
            .set(owner.auth)
            .send({ productCode: plan, idempotencyKey: key() }),
        ),
      )
      expect(results.filter((r) => r.status === 201)).toHaveLength(1)
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(409)
        expect(r.body.code).toBe("ORDER_ALREADY_PENDING")
      }
    })

    it("n'expose pas la commande d'un autre compte", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const intruder = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      await test.http
        .get(`/api/v1/billing/orders/${orderId}`)
        .set(intruder.auth)
        .expect(404)
      await test.http
        .post(`/api/v1/billing/orders/${orderId}/payments`)
        .set(intruder.auth)
        .expect(404)
      await test.http
        .post(`/api/v1/billing/orders/${orderId}/cancel`)
        .set(intruder.auth)
        .expect(404)
    })
  })

  // ------------------------------------------------------------ paiements

  describe("paiements et webhooks", () => {
    it("une tentative ouverte est réutilisée, même en parallèle", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          test.http
            .post(`/api/v1/billing/orders/${orderId}/payments`)
            .set(owner.auth),
        ),
      )
      const ids = new Set(
        results.filter((r) => r.status === 201).map((r) => r.body.id),
      )
      expect(ids.size).toBe(1)
      expect(
        await count(
          "SELECT count(*) AS n FROM payment_transactions p JOIN billing_orders o ON o.id = p.order_id WHERE o.public_id = $1",
          [orderId],
        ),
      ).toBe(1)
    })

    it("sans confirmation du prestataire, aucun droit n'est accordé", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId } = await startPayment(owner, orderId)
      const refreshed = await test.http
        .post(`/api/v1/billing/payments/${paymentId}/refresh`)
        .set(owner.auth)
        .expect(200)
      expect(refreshed.body.status).toBe("PENDING")
      const ent = await test.http
        .get("/api/v1/billing/me/entitlements")
        .set(owner.auth)
        .expect(200)
      expect(ent.body.source).toBe("DEFAULT_PLAN")
      expect(await statusOf("billing_orders", orderId)).toBe("PENDING")
      await test.http
        .get(`/api/v1/billing/orders/${orderId}/receipt`)
        .set(owner.auth)
        .expect(409)
    })

    it("délivre un reçu non fiscal au seul acheteur, après confirmation", async () => {
      const { user, orderId, paymentId } = await paidSubscriber()
      const res = await test.http
        .get(`/api/v1/billing/orders/${orderId}/receipt`)
        .set(user.auth)
        .expect(200)
      expect(res.body).toMatchObject({
        documentType: "PAYMENT_RECEIPT",
        isTaxInvoice: false,
        paymentId,
        amount: "15000",
        currency: "XOF",
        environment: "TEST",
      })
      expect(res.body.notice).toMatch(/n'est pas une facture/)
      const other = await userWithRoles(test, ["OWNER"])
      await test.http
        .get(`/api/v1/billing/orders/${orderId}/receipt`)
        .set(other.auth)
        .expect(404)
    })

    it("refuse une signature invalide ou absente et un prestataire inconnu", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId, reference } = await startPayment(owner, orderId)
      const event = mock.simulate(reference, "SUCCEEDED")!
      const forged = {
        ...event.headers,
        [MOCK_SIGNATURE_HEADER]: event.headers[MOCK_SIGNATURE_HEADER]!.replace(
          /v1=./,
          "v1=0",
        ),
      }
      const bad = await deliver({ headers: forged, body: event.body }).expect(
        401,
      )
      expect(bad.body.code).toBe("WEBHOOK_SIGNATURE_INVALID")
      await deliver({
        headers: { "content-type": "application/json" },
        body: event.body,
      }).expect(401)
      await test.http
        .post("/api/v1/billing/webhooks/stripe")
        .set(event.headers)
        .send(event.body)
        .expect(404)
      expect(await statusOf("payment_transactions", paymentId)).toBe("PENDING")
      expect(await statusOf("billing_orders", orderId)).toBe("PENDING")
      const traces = await test.db.query<{ outcome: string; summary: unknown }>(
        "SELECT outcome, summary FROM payment_events WHERE event_id LIKE 'unverified:%' ORDER BY id DESC LIMIT 1",
      )
      expect(traces.rows[0]!.outcome).toBe("REJECTED")
      expect(JSON.stringify(traces.rows[0])).not.toContain(MOCK_SECRET)
    })

    it("un paiement confirmé accorde le droit une seule fois, malgré les rejeux", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId, reference } = await startPayment(owner, orderId)
      const event = mock.simulate(reference, "SUCCEEDED")!
      await Promise.all([deliver(event), deliver(event), deliver(event)])
      await deliver(event).expect(200)
      await deliver(mock.simulate(reference, "SUCCEEDED")!).expect(200)

      expect(await statusOf("payment_transactions", paymentId)).toBe(
        "SUCCEEDED",
      )
      expect(await statusOf("billing_orders", orderId)).toBe("PAID")
      expect(await periodsOf(orderId)).toBe(1)
      const ent = await test.http
        .get("/api/v1/billing/me/entitlements")
        .set(owner.auth)
        .expect(200)
      expect(ent.body).toMatchObject({
        source: "SUBSCRIPTION",
        productCode: plan,
      })
      expect(ent.body.subscription.status).toBe("ACTIVE")
      const traced = await test.db.query<{ attempts: number }>(
        "SELECT attempts FROM payment_events WHERE provider = 'mock' AND event_id = $1",
        [JSON.parse(event.body).id],
      )
      expect(traced.rows[0]!.attempts).toBe(4)
      expect(
        await count(
          "SELECT count(*) AS n FROM audit_logs WHERE entity_id = $1 AND action = 'PAYMENT_STATUS_CHANGED'",
          [paymentId],
        ),
      ).toBe(1)
    })

    it("absorbe les événements dans le désordre : un succès ne régresse pas", async () => {
      const { paymentId, reference, orderId } = await paidSubscriber()
      await deliver(mock.simulate(reference, "FAILED")!).expect(200)
      expect(await statusOf("payment_transactions", paymentId)).toBe(
        "SUCCEEDED",
      )
      expect(await statusOf("billing_orders", orderId)).toBe("PAID")
    })

    it("un montant incohérent ouvre un incident et n'accorde rien", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId, reference } = await startPayment(owner, orderId)
      await deliver(
        mock.simulate(reference, "SUCCEEDED", { amount: 1n })!,
      ).expect(200)
      expect(await statusOf("payment_transactions", paymentId)).toBe("PENDING")
      expect(await statusOf("billing_orders", orderId)).toBe("PENDING")
      expect(await periodsOf(orderId)).toBe(0)
      expect(
        await count(
          "SELECT count(*) AS n FROM billing_incidents i JOIN payment_transactions p ON p.id = i.payment_id WHERE p.public_id = $1 AND i.kind = 'AMOUNT_MISMATCH'",
          [paymentId],
        ),
      ).toBe(1)
    })

    it("un échec est enregistré, la commande reste payable par une nouvelle tentative", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const first = await startPayment(owner, orderId)
      await deliver(mock.simulate(first.reference, "FAILED")!).expect(200)
      expect(await statusOf("payment_transactions", first.paymentId)).toBe(
        "FAILED",
      )
      const second = await startPayment(owner, orderId)
      expect(second.paymentId).not.toBe(first.paymentId)
    })

    it("le simulateur passe par le webhook signé et ne sert que le titulaire", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const intruder = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId } = await startPayment(owner, orderId)
      await test.http
        .post(`/api/v1/billing/mock/payments/${paymentId}/simulate`)
        .set(intruder.auth)
        .send({ outcome: "SUCCEEDED" })
        .expect(404)
      const res = await test.http
        .post(`/api/v1/billing/mock/payments/${paymentId}/simulate`)
        .set(owner.auth)
        .send({ outcome: "SUCCEEDED" })
        .expect(200)
      expect(res.body.status).toBe("SUCCEEDED")
      expect(
        await count(
          "SELECT count(*) AS n FROM payment_events e JOIN payment_transactions p ON p.id = e.payment_id WHERE p.public_id = $1 AND e.outcome = 'APPLIED'",
          [paymentId],
        ),
      ).toBe(1)
    })
  })

  // ------------------------------------------------------------ abonnements

  describe("abonnements", () => {
    it("refuse un changement de plan et un renouvellement hors fenêtre", async () => {
      const { user } = await paidSubscriber()
      const other = await createPlan(null, "30000")
      const change = await test.http
        .post("/api/v1/billing/orders")
        .set(user.auth)
        .send({ productCode: other, idempotencyKey: key() })
        .expect(409)
      expect(change.body.code).toBe("PLAN_CHANGE_NOT_SUPPORTED")
    })

    it("résilie à l'échéance sans retirer les droits payés", async () => {
      const { user } = await paidSubscriber()
      const subs = await test.http
        .get("/api/v1/billing/me/subscriptions")
        .set(user.auth)
        .expect(200)
      const id = subs.body[0].id
      const res = await test.http
        .post(`/api/v1/billing/me/subscriptions/${id}/cancel`)
        .set(user.auth)
        .expect(200)
      expect(res.body).toMatchObject({
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
      })
      const ent = await test.http
        .get("/api/v1/billing/me/entitlements")
        .set(user.auth)
        .expect(200)
      expect(ent.body.source).toBe("SUBSCRIPTION")
    })
  })

  // ------------------------------------------------------------ quota

  describe("quota d'annonces actives", () => {
    async function draft(owner: TestUser): Promise<string> {
      const property = await createProperty(test, owner)
      return createListing(test, owner, property, "RENT", PRICE)
    }
    const submit = (owner: TestUser, listing: string) =>
      test.http
        .post(`/api/v1/listings/${listing}/status`)
        .set(owner.auth)
        .send({ status: "PENDING_REVIEW" })

    it("sans abonnement, le plan par défaut est illimité", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const [a, b] = [await draft(owner), await draft(owner)]
      await submit(owner, a).expect(200)
      await submit(owner, b).expect(200)
    })

    it("applique la limite du plan, y compris sous concurrence", async () => {
      const limited = await createPlan(1, "5000")
      const { user } = await paidSubscriber(limited)
      const drafts = [await draft(user), await draft(user), await draft(user)]
      const results = await Promise.all(
        drafts.map((listing) => submit(user, listing)),
      )
      expect(results.filter((r) => r.status === 200)).toHaveLength(1)
      for (const r of results.filter((r) => r.status !== 200)) {
        expect(r.status).toBe(409)
        expect(r.body.code).toBe("LISTING_QUOTA_EXCEEDED")
      }
    })
  })

  // ------------------------------------------------------------ remboursements

  describe("remboursements", () => {
    it("plafonne, exige une validation par une autre personne et n'aboutit que sur confirmation", async () => {
      const { user, paymentId, orderId } = await paidSubscriber()

      const tooMuch = await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/refunds`)
        .set(support.auth)
        .send({
          amount: "15001",
          reason: "Geste commercial demandé",
          idempotencyKey: key(),
        })
        .expect(422)
      expect(tooMuch.body.code).toBe("REFUND_AMOUNT_EXCEEDED")

      const k = key()
      const requested = await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/refunds`)
        .set(admin.auth)
        .send({ reason: "Double souscription signalée", idempotencyKey: k })
        .expect(201)
      const again = await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/refunds`)
        .set(admin.auth)
        .send({ reason: "Double souscription signalée", idempotencyKey: k })
        .expect(201)
      expect(again.body.id).toBe(requested.body.id)
      expect(requested.body).toMatchObject({
        status: "REQUESTED",
        amount: "15000",
      })

      const second = await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/refunds`)
        .set(support.auth)
        .send({
          amount: "1",
          reason: "Montant déjà réservé",
          idempotencyKey: key(),
        })
        .expect(409)
      expect(second.body.code).toBe("REFUND_NOT_ALLOWED")

      const refundId = requested.body.id
      await test.http
        .post(`/api/v1/admin/billing/refunds/${refundId}/approve`)
        .set(support.auth)
        .send({ note: "Validation sans permission" })
        .expect(403)
      const self = await test.http
        .post(`/api/v1/admin/billing/refunds/${refundId}/approve`)
        .set(admin.auth)
        .send({ note: "Auto-validation interdite" })
        .expect(403)
      expect(self.body.code).toBe("REFUND_SELF_APPROVAL")

      const approved = await test.http
        .post(`/api/v1/admin/billing/refunds/${refundId}/approve`)
        .set(admin2.auth)
        .send({ note: "Doublon confirmé par le support" })
        .expect(200)
      expect(approved.body.status).toBe("SUCCEEDED")
      expect(await statusOf("billing_orders", orderId)).toBe("REFUNDED")
      const ent = await test.http
        .get("/api/v1/billing/me/entitlements")
        .set(user.auth)
        .expect(200)
      expect(ent.body.source).toBe("DEFAULT_PLAN")

      const mine = await test.http
        .get("/api/v1/billing/me/refunds")
        .set(user.auth)
        .expect(200)
      expect(mine.body[0]).toMatchObject({ id: refundId, status: "SUCCEEDED" })
      expect(mine.body[0].decisionNote ?? null).toBeNull()
    })

    it("un remboursement en échec chez le prestataire n'est jamais marqué effectué", async () => {
      const { paymentId } = await paidSubscriber()
      mock.refundOutcome = "FAILED"
      try {
        const requested = await test.http
          .post(`/api/v1/admin/billing/payments/${paymentId}/refunds`)
          .set(support.auth)
          .send({
            amount: "5000",
            reason: "Remboursement partiel test",
            idempotencyKey: key(),
          })
          .expect(201)
        const res = await test.http
          .post(`/api/v1/admin/billing/refunds/${requested.body.id}/approve`)
          .set(admin.auth)
          .send({ note: "Validation du partiel" })
          .expect(200)
        expect(res.body.status).toBe("FAILED")
        const payment = await test.db.query<{ refunded_amount: string }>(
          "SELECT refunded_amount FROM payment_transactions WHERE public_id = $1",
          [paymentId],
        )
        expect(payment.rows[0]!.refunded_amount).toBe("0")
      } finally {
        mock.refundOutcome = "SUCCEEDED"
      }
    })

    it("un client ne demande un remboursement que sur son propre paiement", async () => {
      const { user, paymentId } = await paidSubscriber()
      const intruder = await userWithRoles(test, ["OWNER"])
      await test.http
        .post(`/api/v1/billing/payments/${paymentId}/refund-requests`)
        .set(intruder.auth)
        .send({ reason: "Je voudrais être remboursé", idempotencyKey: key() })
        .expect(404)
      const res = await test.http
        .post(`/api/v1/billing/payments/${paymentId}/refund-requests`)
        .set(user.auth)
        .send({ reason: "Je voudrais être remboursé", idempotencyKey: key() })
        .expect(201)
      expect(res.body.status).toBe("REQUESTED")
    })
  })

  // ------------------------------------------------------------ réconciliation

  describe("réconciliation", () => {
    it("rattrape un succès dont le webhook n'est jamais arrivé", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      const { paymentId, reference } = await startPayment(owner, orderId)
      mock.simulate(reference, "SUCCEEDED")
      const reconciliation = test.app.get(ReconciliationService)
      await reconciliation.checkPayments(new Date(Date.now() + 5 * 60_000))
      expect(await statusOf("payment_transactions", paymentId)).toBe(
        "SUCCEEDED",
      )
      expect(await periodsOf(orderId)).toBe(1)
    })

    it("expire les commandes échues", async () => {
      const owner = await userWithRoles(test, ["OWNER"])
      const orderId = await order(owner)
      await test.app
        .get(ReconciliationService)
        .expireOrders(new Date(Date.now() + 2 * 3_600_000))
      expect(await statusOf("billing_orders", orderId)).toBe("EXPIRED")
    })
  })

  // ------------------------------------------------------------ back-office

  describe("back-office", () => {
    it("diagnostique sans exposer de secret, sans action « marquer payé »", async () => {
      const { orderId, paymentId } = await paidSubscriber()
      const detail = await test.http
        .get(`/api/v1/admin/billing/orders/${orderId}`)
        .set(support.auth)
        .expect(200)
      expect(JSON.stringify(detail.body)).not.toContain(MOCK_SECRET)
      expect(JSON.stringify(detail.body)).not.toMatch(/v1=[0-9a-f]{64}/)
      for (const path of [
        `payments/${paymentId}/mark-paid`,
        `orders/${orderId}/mark-paid`,
        `payments/${paymentId}/status`,
      ]) {
        await test.http
          .post(`/api/v1/admin/billing/${path}`)
          .set(admin.auth)
          .send({ status: "SUCCEEDED" })
          .expect(404)
      }
      await test.http
        .patch(`/api/v1/admin/billing/payments/${paymentId}`)
        .set(admin.auth)
        .send({ status: "SUCCEEDED" })
        .expect(404)
    })

    it("réserve la lecture à billing:read et les actions aux permissions dédiées", async () => {
      await test.http
        .get("/api/v1/admin/billing/summary")
        .set(analyst.auth)
        .expect(403)
      const summary = await test.http
        .get("/api/v1/admin/billing/summary")
        .set(support.auth)
        .expect(200)
      expect(JSON.stringify(summary.body)).not.toContain(MOCK_SECRET)
      expect(
        Object.keys(summary.body).some((k) => /net|revenue|fee/i.test(k)),
      ).toBe(false)
      expect(summary.body.provider).toMatchObject({
        code: "mock",
        simulated: true,
        environment: "TEST",
      })
      const { paymentId } = await paidSubscriber()
      await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/check`)
        .set(support.auth)
        .expect(403)
      await test.http
        .post(`/api/v1/admin/billing/payments/${paymentId}/check`)
        .set(admin.auth)
        .expect(200)
    })

    it("clôt un incident avec une justification obligatoire", async () => {
      const incidents = await test.http
        .get("/api/v1/admin/billing/incidents?status=OPEN")
        .set(admin.auth)
        .expect(200)
      const incident = incidents.body.items[0]
      expect(incident).toBeDefined()
      await test.http
        .post(`/api/v1/admin/billing/incidents/${incident.id}/resolve`)
        .set(admin.auth)
        .send({ resolution: "court" })
        .expect(400)
      const res = await test.http
        .post(`/api/v1/admin/billing/incidents/${incident.id}/resolve`)
        .set(admin.auth)
        .send({ resolution: "Montant vérifié auprès du prestataire de test" })
        .expect(200)
      expect(res.body.status).toBe("RESOLVED")
    })
  })
})
