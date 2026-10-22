import { describe, expect, it } from "vitest"

import {
  amountJson,
  isSupportedCurrency,
  MAX_AMOUNT,
  parseAmount,
  sameMoney,
} from "./money"
import {
  decidePayment,
  isOrderCancellable,
  isOrderPayable,
  orderOnPaymentSuccess,
  safeFailureCode,
} from "./payment-rules"
import { isFullRefund, refundableAmount } from "./refund-rules"
import {
  addMonths,
  dueTransition,
  endAfterRevocation,
  grantsRights,
  isRenewalOpen,
  nextPeriod,
  quotaAllows,
} from "./subscription-rules"
import { sha256Hex, signPayload, verifySignature } from "./webhook-signature"

const at = (iso: string) => new Date(iso)

describe("montants", () => {
  it("accepte des entiers positifs bornés, jamais de flottant", () => {
    expect(parseAmount("15000")).toBe(15000n)
    expect(parseAmount(15000)).toBe(15000n)
    expect(parseAmount(15000n)).toBe(15000n)
    expect(parseAmount(MAX_AMOUNT)).toBe(MAX_AMOUNT)
    for (const invalid of [
      0,
      -1,
      1.5,
      "1.5",
      "-3",
      "1e3",
      " 10",
      "",
      null,
      MAX_AMOUNT + 1n,
      Number.MAX_SAFE_INTEGER + 2,
    ]) {
      expect(parseAmount(invalid)).toBeNull()
    }
  })

  it("sérialise en chaîne sans perte et compare montant et devise", () => {
    expect(amountJson(9_007_199_254_740_993n)).toBe("9007199254740993")
    expect(
      sameMoney(
        { amount: 1n, currency: "XOF" },
        { amount: 1n, currency: "XOF" },
      ),
    ).toBe(true)
    expect(
      sameMoney(
        { amount: 1n, currency: "XOF" },
        { amount: 1n, currency: "EUR" },
      ),
    ).toBe(false)
    expect(isSupportedCurrency("XOF")).toBe(true)
    expect(isSupportedCurrency("EUR")).toBe(false)
  })
})

describe("machine à états des paiements", () => {
  it("applique une transition depuis un état ouvert", () => {
    expect(decidePayment("CREATED", "PENDING")).toEqual({
      action: "apply",
      next: "PENDING",
      lateSuccess: false,
    })
    expect(decidePayment("PENDING", "SUCCEEDED")).toEqual({
      action: "apply",
      next: "SUCCEEDED",
      lateSuccess: false,
    })
    expect(decidePayment("PENDING", "FAILED")).toEqual({
      action: "apply",
      next: "FAILED",
      lateSuccess: false,
    })
  })

  it("ignore une notification rejouée", () => {
    expect(decidePayment("SUCCEEDED", "SUCCEEDED")).toEqual({ action: "noop" })
    expect(decidePayment("PENDING", "PENDING")).toEqual({ action: "noop" })
  })

  it("ne fait jamais régresser un succès (événements dans le désordre)", () => {
    for (const reported of [
      "PENDING",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
    ] as const) {
      expect(decidePayment("SUCCEEDED", reported)).toEqual({
        action: "ignore",
        reason: "REGRESSION",
      })
    }
  })

  it("applique un succès tardif après un échec, en le signalant", () => {
    for (const current of ["FAILED", "CANCELLED", "EXPIRED"] as const) {
      expect(decidePayment(current, "SUCCEEDED")).toEqual({
        action: "apply",
        next: "SUCCEEDED",
        lateSuccess: true,
      })
    }
    expect(decidePayment("FAILED", "CANCELLED")).toEqual({
      action: "ignore",
      reason: "TERMINAL",
    })
    expect(decidePayment("EXPIRED", "PENDING")).toEqual({
      action: "ignore",
      reason: "TERMINAL",
    })
  })

  it("ne sert jamais deux fois une commande payée", () => {
    expect(orderOnPaymentSuccess("PENDING")).toBe("MARK_PAID")
    expect(orderOnPaymentSuccess("EXPIRED")).toBe("MARK_PAID")
    expect(orderOnPaymentSuccess("CANCELLED")).toBe("MARK_PAID")
    expect(orderOnPaymentSuccess("PAID")).toBe("DUPLICATE")
    expect(orderOnPaymentSuccess("REFUNDED")).toBe("DUPLICATE")
  })

  it("borne le paiement et l'annulation aux commandes en attente non échues", () => {
    const now = at("2026-10-13T10:00:00Z")
    expect(
      isOrderPayable(
        { status: "PENDING", expiresAt: at("2026-10-13T11:00:00Z") },
        now,
      ),
    ).toBe(true)
    expect(isOrderPayable({ status: "PENDING", expiresAt: now }, now)).toBe(
      false,
    )
    expect(
      isOrderPayable(
        { status: "PAID", expiresAt: at("2026-10-14T00:00:00Z") },
        now,
      ),
    ).toBe(false)
    expect(isOrderCancellable("PENDING")).toBe(true)
    expect(isOrderCancellable("PAID")).toBe(false)
  })

  it("réduit les codes d'échec à un format sûr", () => {
    expect(safeFailureCode(" insufficient_funds ")).toBe("INSUFFICIENT_FUNDS")
    expect(safeFailureCode("carte 4111 1111 1111 1111")).toBe("UNKNOWN")
    expect(safeFailureCode(42)).toBeNull()
  })
})

describe("abonnements", () => {
  it("ajoute des mois calendaires en ramenant au dernier jour du mois", () => {
    expect(addMonths(at("2026-01-31T08:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T08:00:00.000Z",
    )
    expect(addMonths(at("2028-01-31T08:00:00Z"), 1).toISOString()).toBe(
      "2028-02-29T08:00:00.000Z",
    )
    expect(addMonths(at("2026-11-15T00:00:00Z"), 3).toISOString()).toBe(
      "2027-02-15T00:00:00.000Z",
    )
  })

  it("prolonge depuis l'échéance en cours, ou depuis le paiement après l'échéance", () => {
    const now = at("2026-10-13T00:00:00Z")
    expect(nextPeriod(at("2026-10-20T00:00:00Z"), 1, now)).toEqual({
      start: at("2026-10-20T00:00:00Z"),
      end: at("2026-11-20T00:00:00Z"),
    })
    expect(nextPeriod(at("2026-10-01T00:00:00Z"), 1, now).start).toEqual(now)
    expect(nextPeriod(null, 12, now).end).toEqual(at("2027-10-13T00:00:00Z"))
  })

  it("n'ouvre le renouvellement que dans la fenêtre ou pendant la grâce", () => {
    const now = at("2026-10-13T00:00:00Z")
    const active = (end: string) => ({
      status: "ACTIVE" as const,
      currentPeriodEnd: at(end),
      cancelAtPeriodEnd: false,
    })
    expect(isRenewalOpen(active("2026-10-20T00:00:00Z"), now, 7)).toBe(true)
    expect(isRenewalOpen(active("2026-11-20T00:00:00Z"), now, 7)).toBe(false)
    expect(
      isRenewalOpen(
        { ...active("2026-10-10T00:00:00Z"), status: "PAST_DUE" },
        now,
        7,
      ),
    ).toBe(true)
    expect(
      isRenewalOpen(
        { ...active("2026-10-20T00:00:00Z"), status: "EXPIRED" },
        now,
        30,
      ),
    ).toBe(false)
  })

  it("applique les échéances sans prélèvement automatique", () => {
    const end = at("2026-10-10T00:00:00Z")
    const state = {
      status: "ACTIVE" as const,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    }
    expect(dueTransition(state, at("2026-10-09T00:00:00Z"), 3)).toBeNull()
    expect(dueTransition(state, at("2026-10-11T00:00:00Z"), 3)).toEqual({
      status: "PAST_DUE",
      endedAt: null,
    })
    expect(dueTransition(state, at("2026-10-14T00:00:00Z"), 3)).toEqual({
      status: "EXPIRED",
      endedAt: end,
    })
    expect(dueTransition(state, at("2026-10-11T00:00:00Z"), 0)).toEqual({
      status: "EXPIRED",
      endedAt: end,
    })
    expect(
      dueTransition(
        { ...state, cancelAtPeriodEnd: true },
        at("2026-10-11T00:00:00Z"),
        3,
      ),
    ).toEqual({
      status: "CANCELLED",
      endedAt: end,
    })
    expect(
      dueTransition(
        { ...state, status: "PAST_DUE" },
        at("2026-10-12T00:00:00Z"),
        3,
      ),
    ).toBeNull()
    expect(
      dueTransition(
        { ...state, status: "PAST_DUE" },
        at("2026-10-13T00:00:00Z"),
        3,
      ),
    ).toEqual({
      status: "EXPIRED",
      endedAt: end,
    })
  })

  it("accorde les droits jusqu'à l'échéance plus la grâce", () => {
    const sub = {
      status: "PAST_DUE" as const,
      currentPeriodEnd: at("2026-10-10T00:00:00Z"),
    }
    expect(grantsRights(sub, at("2026-10-12T00:00:00Z"), 3)).toBe(true)
    expect(grantsRights(sub, at("2026-10-13T00:00:00Z"), 3)).toBe(false)
    expect(
      grantsRights(
        { ...sub, status: "CANCELLED" },
        at("2026-10-01T00:00:00Z"),
        3,
      ),
    ).toBe(false)
  })

  it("retire une période remboursée, ou termine l'abonnement", () => {
    const now = at("2026-10-13T00:00:00Z")
    const subscription = {
      currentPeriodStart: at("2026-10-01T00:00:00Z"),
      currentPeriodEnd: at("2026-12-01T00:00:00Z"),
    }
    expect(
      endAfterRevocation(
        subscription,
        {
          periodStart: at("2026-11-01T00:00:00Z"),
          periodEnd: at("2026-12-01T00:00:00Z"),
        },
        now,
      ),
    ).toEqual(at("2026-11-01T00:00:00Z"))
    expect(
      endAfterRevocation(
        subscription,
        {
          periodStart: at("2026-10-01T00:00:00Z"),
          periodEnd: at("2026-12-01T00:00:00Z"),
        },
        now,
      ),
    ).toBeNull()
  })

  it("applique le quota d'annonces, illimité par défaut", () => {
    expect(quotaAllows(null, 10_000)).toBe(true)
    expect(quotaAllows(3, 2)).toBe(true)
    expect(quotaAllows(3, 3)).toBe(false)
    expect(quotaAllows(0, 0)).toBe(false)
  })
})

describe("remboursements", () => {
  const payment = {
    status: "SUCCEEDED" as const,
    amount: 10_000n,
    refundedAmount: 2_000n,
  }

  it("plafonne au montant encaissé moins le remboursé et le réservé", () => {
    expect(refundableAmount(payment, [])).toBe(8_000n)
    expect(refundableAmount(payment, [{ amount: 5_000n }])).toBe(3_000n)
    expect(refundableAmount(payment, [{ amount: 9_000n }])).toBe(0n)
    expect(refundableAmount({ ...payment, status: "PENDING" }, [])).toBe(0n)
  })

  it("reconnaît un remboursement intégral", () => {
    expect(isFullRefund(payment)).toBe(false)
    expect(isFullRefund({ amount: 10_000n, refundedAmount: 10_000n })).toBe(
      true,
    )
  })
})

describe("signature des webhooks", () => {
  const secret = "test-only-secret-for-unit-tests-0123456789"
  const body = Buffer.from('{"id":"evt_12345678"}')
  const now = 1_800_000_000

  it("accepte une signature valide et récente", () => {
    expect(
      verifySignature(
        secret,
        body,
        signPayload(secret, body, now),
        now + 10,
        300,
      ),
    ).toEqual({ valid: true })
  })

  it("refuse signature absente, mal formée, périmée ou falsifiée", () => {
    expect(verifySignature(secret, body, undefined, now, 300)).toEqual({
      valid: false,
      reason: "MISSING",
    })
    expect(verifySignature(secret, body, "v1=abc", now, 300)).toEqual({
      valid: false,
      reason: "MALFORMED",
    })
    expect(
      verifySignature(
        secret,
        body,
        signPayload(secret, body, now - 301),
        now,
        300,
      ),
    ).toEqual({
      valid: false,
      reason: "STALE",
    })
    expect(
      verifySignature(
        secret,
        body,
        signPayload("autre-secret", body, now),
        now,
        300,
      ),
    ).toEqual({
      valid: false,
      reason: "MISMATCH",
    })
    const tampered = Buffer.from('{"id":"evt_87654321"}')
    expect(
      verifySignature(
        secret,
        tampered,
        signPayload(secret, body, now),
        now,
        300,
      ),
    ).toEqual({
      valid: false,
      reason: "MISMATCH",
    })
  })

  it("calcule une empreinte stable sans exposer le corps", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })
})
