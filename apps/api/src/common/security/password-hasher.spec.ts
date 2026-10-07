import { hashPassword, verifyPassword } from "./password-hasher"

describe("password hasher", () => {
  it("produit un hash Argon2id vérifiable", async () => {
    const password = "phrase-de-test-seulement"
    const passwordHash = await hashPassword(password)
    expect(passwordHash).not.toBe(password)
    expect(passwordHash.startsWith("$argon2id$")).toBe(true)
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true)
    await expect(verifyPassword(passwordHash, "autre")).resolves.toBe(false)
  })
})
