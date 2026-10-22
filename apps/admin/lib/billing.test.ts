import { describe, expect, it } from "vitest"

import { billingTab, parseQuota, refundableAmount } from "./billing"
import { formatMoney } from "./format"

describe("facturation : aides d'affichage", () => {
  it("formate un montant entier sans passer par un flottant", () => {
    expect(formatMoney("9007199254740993", "XOF")).toMatch(/993 XOF$/)
    expect(formatMoney("5000", "XOF").replace(/\s/g, " ")).toBe("5 000 XOF")
  })

  it("n'invente pas de montant quand la valeur est absente ou invalide", () => {
    expect(formatMoney(null, "XOF")).toBe("—")
    expect(formatMoney("12.5", "XOF")).toBe("—")
    expect(formatMoney("-3", "XOF")).toBe("—")
  })

  it("calcule le remboursable uniquement sur un paiement réussi", () => {
    expect(
      refundableAmount({
        status: "SUCCEEDED",
        amount: "5000",
        refundedAmount: "1500",
      }),
    ).toBe(BigInt(3500))
    expect(
      refundableAmount({
        status: "PENDING",
        amount: "5000",
        refundedAmount: "0",
      }),
    ).toBe(BigInt(0))
    expect(
      refundableAmount({
        status: "SUCCEEDED",
        amount: "5000",
        refundedAmount: "5000",
      }),
    ).toBe(BigInt(0))
  })

  it("valide le quota saisi (vide = illimité)", () => {
    expect(parseQuota("")).toBeNull()
    expect(parseQuota(" 3 ")).toBe(3)
    expect(parseQuota("-1")).toBeUndefined()
    expect(parseQuota("2.5")).toBeUndefined()
  })

  it("retombe sur la synthèse pour un onglet inconnu", () => {
    expect(billingTab("refunds")).toBe("refunds")
    expect(billingTab("mark-paid")).toBe("summary")
    expect(billingTab(undefined)).toBe("summary")
  })
})
