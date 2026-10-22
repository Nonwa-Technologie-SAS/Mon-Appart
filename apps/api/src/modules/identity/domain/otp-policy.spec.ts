import { makeHasher } from "../testing/identity-test-kit"
import { evaluateOtp, generateOtpCode, otpPrecheck } from "./otp-policy"

const now = new Date("2026-10-07T12:00:00Z")
const future = new Date("2026-10-07T12:05:00Z")
const past = new Date("2026-10-07T11:59:00Z")

const base = {
  attempts: 0,
  maxAttempts: 5,
  expiresAt: future,
  consumedAt: null,
}

describe("OTP", () => {
  const hasher = makeHasher()

  it("génère un code numérique de la longueur demandée", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateOtpCode(6)).toMatch(/^\d{6}$/)
    }
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/)
  })

  it("stocke un hash, jamais le code, lié au défi", () => {
    const hash = hasher.hash("otp-code", "challenge-a:123456")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain("123456")
    expect(hasher.hash("otp-code", "challenge-b:123456")).not.toBe(hash)
  })

  it("accepte le bon code", () => {
    const codeHash = hasher.hash("otp-code", "c:123456")
    const outcome = evaluateOtp(base, now, () =>
      hasher.matches("otp-code", "c:123456", codeHash),
    )
    expect(outcome).toBe("OK")
  })

  it("refuse un mauvais code", () => {
    const codeHash = hasher.hash("otp-code", "c:123456")
    const outcome = evaluateOtp(base, now, () =>
      hasher.matches("otp-code", "c:654321", codeHash),
    )
    expect(outcome).toBe("INVALID")
  })

  it("refuse un code expiré sans comparer", () => {
    let compared = false
    const outcome = evaluateOtp(
      { ...base, expiresAt: past },
      now,
      () => (compared = true),
    )
    expect(outcome).toBe("EXPIRED")
    expect(compared).toBe(false)
  })

  it("refuse après le nombre maximal d'essais", () => {
    expect(otpPrecheck({ ...base, attempts: 5 }, now)).toBe("MAX_ATTEMPTS")
    expect(otpPrecheck({ ...base, attempts: 4 }, now)).toBe("OK")
  })

  it("refuse un code déjà consommé", () => {
    expect(evaluateOtp({ ...base, consumedAt: past }, now, () => true)).toBe(
      "CONSUMED",
    )
  })
})
