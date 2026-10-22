import { UserStatus } from "../../../generated/prisma/enums"
import { loginBlockReason, statusAfterVerification } from "./account-policy"
import { normalizeEmail, normalizePhone, parseIdentifier } from "./identifier"
import { assertPasswordStrength, passwordWeakness } from "./password-policy"

describe("identifiants", () => {
  it("normalise un email en minuscules", () => {
    expect(normalizeEmail("  Awa.Kone@Example.COM ")).toBe(
      "awa.kone@example.com",
    )
    expect(normalizeEmail("pas-un-email")).toBeNull()
  })

  it("interprète un numéro local comme ivoirien (+225)", () => {
    expect(normalizePhone("07 01 02 03 04")).toBe("+2250701020304")
    expect(normalizePhone("+225 07 01 02 03 04")).toBe("+2250701020304")
  })

  it("accepte un numéro étranger au format international", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678")
  })

  it("rejette un numéro invalide", () => {
    expect(normalizePhone("123")).toBeNull()
    expect(normalizePhone("abc")).toBeNull()
  })

  it("détecte email ou téléphone", () => {
    expect(parseIdentifier("Awa@Example.com")).toEqual({
      kind: "email",
      value: "awa@example.com",
    })
    expect(parseIdentifier("0701020304")).toEqual({
      kind: "phone",
      value: "+2250701020304",
    })
    expect(parseIdentifier("n'importe quoi")).toBeNull()
  })
})

describe("politique de mot de passe", () => {
  it("exige au moins 10 caractères sans règle de composition", () => {
    expect(passwordWeakness("court")).toBe("too_short")
    expect(passwordWeakness("une phrase toute simple")).toBeNull()
  })

  it("refuse les mots de passe courants et répétitifs", () => {
    expect(passwordWeakness("azertyuiop")).toBe("common")
    expect(passwordWeakness("aaaaaaaaaaaa")).toBe("repetitive")
  })

  it("refuse un mot de passe contenant l'identifiant", () => {
    expect(
      passwordWeakness("awakone-2026!", { email: "awakone@example.com" }),
    ).toBe("contains_identifier")
    expect(passwordWeakness("x0701020304x", { phone: "+2250701020304" })).toBe(
      "contains_identifier",
    )
  })

  it("lève PASSWORD_TOO_WEAK", () => {
    expect(() => assertPasswordStrength("court")).toThrow(
      expect.objectContaining({ code: "PASSWORD_TOO_WEAK" }),
    )
  })
})

describe("politique de statut", () => {
  it("bloque BANNED, SUSPENDED et INACTIVE", () => {
    expect(loginBlockReason(UserStatus.BANNED)).toBe("ACCOUNT_BANNED")
    expect(loginBlockReason(UserStatus.SUSPENDED)).toBe("ACCOUNT_SUSPENDED")
    expect(loginBlockReason(UserStatus.INACTIVE)).toBe("ACCOUNT_INACTIVE")
  })

  it("laisse entrer PENDING et ACTIVE", () => {
    expect(loginBlockReason(UserStatus.PENDING)).toBeNull()
    expect(loginBlockReason(UserStatus.ACTIVE)).toBeNull()
  })

  it("active un compte en attente après vérification", () => {
    expect(statusAfterVerification(UserStatus.PENDING)).toBe(UserStatus.ACTIVE)
    expect(statusAfterVerification(UserStatus.SUSPENDED)).toBe(
      UserStatus.SUSPENDED,
    )
  })
})
