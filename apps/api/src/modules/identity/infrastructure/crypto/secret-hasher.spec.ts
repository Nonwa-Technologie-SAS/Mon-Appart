import { makeConfig, makeHasher } from "../../testing/identity-test-kit"
import { generateOpaqueToken, SecretHasher } from "./secret-hasher"

describe("SecretHasher", () => {
  const hasher = makeHasher()

  it("produit un HMAC hexadécimal déterministe", () => {
    const value = hasher.hash("refresh-token", "token")
    expect(value).toMatch(/^[0-9a-f]{64}$/)
    expect(hasher.hash("refresh-token", "token")).toBe(value)
  })

  it("sépare les usages", () => {
    expect(hasher.hash("refresh-token", "x")).not.toBe(
      hasher.hash("password-reset", "x"),
    )
  })

  it("dépend du secret serveur", () => {
    const other = new SecretHasher(
      makeConfig({
        JWT_REFRESH_SECRET: "un-autre-secret-refresh-de-32-caracteres",
      }).hashKey,
    )
    expect(other.hash("otp-code", "123456")).not.toBe(
      hasher.hash("otp-code", "123456"),
    )
  })

  it("compare sans lever sur une empreinte mal formée", () => {
    const expected = hasher.hash("otp-code", "123456")
    expect(hasher.matches("otp-code", "123456", expected)).toBe(true)
    expect(hasher.matches("otp-code", "000000", expected)).toBe(false)
    expect(hasher.matches("otp-code", "123456", "abc")).toBe(false)
  })

  it("génère des jetons opaques uniques de 256 bits", () => {
    const token = generateOpaqueToken()
    expect(Buffer.from(token, "base64url")).toHaveLength(32)
    expect(generateOpaqueToken()).not.toBe(token)
  })
})
