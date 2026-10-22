import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
  MOCK_SIGNATURE_HEADER,
  MockPaymentProvider,
} from "./mock-payment.provider"

const SECRET = "test-only-mock-secret-0123456789abcdef"

function provider(now = () => new Date()) {
  return new MockPaymentProvider(SECRET, 300, now)
}

async function checkout(mock: MockPaymentProvider, amount = 15_000n) {
  const reference = randomUUID()
  const { providerReference, redirectUrl } = await mock.createCheckout({
    reference,
    amount,
    currency: "XOF",
    description: "Plan test",
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return { reference, providerReference, redirectUrl }
}

describe("MockPaymentProvider", () => {
  it("n'annonce pas de prélèvement automatique", () => {
    expect(provider().capabilities.recurring).toBe(false)
    expect(provider().environment).toBe("TEST")
  })

  it("ouvre une session en attente, sans page de redirection", async () => {
    const mock = provider()
    const { reference, providerReference, redirectUrl } = await checkout(mock)
    expect(redirectUrl).toBeNull()
    expect(await mock.fetchStatus(providerReference)).toMatchObject({
      reference,
      status: "PENDING",
      amount: 15_000n,
      currency: "XOF",
    })
    expect(await mock.fetchStatus("mock_inconnu")).toBeNull()
  })

  it("produit une notification signée que lui seul valide", async () => {
    const mock = provider()
    const { reference, providerReference } = await checkout(mock)
    const event = mock.simulate(providerReference, "SUCCEEDED")!
    const verified = mock.verifyWebhook(event.headers, Buffer.from(event.body))
    expect(verified).toMatchObject({
      valid: true,
      event: {
        kind: "payment",
        reference,
        providerReference,
        status: "SUCCEEDED",
        amount: 15_000n,
      },
    })
    const other = new MockPaymentProvider(
      "un-autre-secret-de-test-0123456789",
      300,
    )
    expect(
      other.verifyWebhook(event.headers, Buffer.from(event.body)),
    ).toMatchObject({
      valid: false,
      reason: "SIGNATURE",
    })
  })

  it("refuse un corps modifié, une signature absente ou périmée", async () => {
    const mock = provider()
    const { providerReference } = await checkout(mock)
    const event = mock.simulate(providerReference, "SUCCEEDED")!
    const tampered = event.body.replace('"15000"', '"1"')
    expect(
      mock.verifyWebhook(event.headers, Buffer.from(tampered)),
    ).toMatchObject({ valid: false, reason: "SIGNATURE" })
    expect(mock.verifyWebhook({}, Buffer.from(event.body))).toMatchObject({
      valid: false,
      reason: "SIGNATURE",
    })
    const old = mock.signedEvent(
      JSON.parse(event.body),
      Math.floor(Date.now() / 1000) - 3_600,
    )
    expect(
      mock.verifyWebhook(old.headers, Buffer.from(old.body)),
    ).toMatchObject({ valid: false, reason: "SIGNATURE" })
  })

  it("refuse un contenu signé mais hors schéma", () => {
    const mock = provider()
    const event = mock.signedEvent({
      id: "evt_12345678",
      type: "payment.updated",
      data: { status: "SUCCEEDED" },
    })
    expect(
      mock.verifyWebhook(event.headers, Buffer.from(event.body)),
    ).toMatchObject({ valid: false, reason: "PAYLOAD" })
    const extra = mock.signedEvent({
      id: "evt_12345678",
      type: "payment.updated",
      card_number: "4111111111111111",
      data: {
        reference: randomUUID(),
        provider_reference: "mock_abcdefgh",
        status: "SUCCEEDED",
        amount: "100",
        currency: "XOF",
        failure_code: null,
      },
    })
    expect(
      mock.verifyWebhook(extra.headers, Buffer.from(extra.body)),
    ).toMatchObject({ valid: false, reason: "PAYLOAD" })
  })

  it("ne met jamais le secret dans la notification", async () => {
    const mock = provider()
    const { providerReference } = await checkout(mock)
    const event = mock.simulate(providerReference, "FAILED")!
    expect(event.body).not.toContain(SECRET)
    expect(event.headers[MOCK_SIGNATURE_HEADER]).not.toContain(SECRET)
  })

  it("rembourse de façon idempotente par référence", async () => {
    const mock = provider()
    const request = {
      reference: randomUUID(),
      paymentProviderReference: "mock_x",
      amount: 100n,
      currency: "XOF",
    }
    const first = await mock.refund(request)
    const second = await mock.refund(request)
    expect(second).toEqual(first)
    expect(first.status).toBe("SUCCEEDED")
  })
})
