import { hashPassword, PasswordHasher, verifyPassword } from "./password-hasher"

describe("password hasher", () => {
  it("produit un hash Argon2id vérifiable", async () => {
    const password = "phrase-de-test-seulement"
    const passwordHash = await hashPassword(password)
    expect(passwordHash).not.toBe(password)
    expect(passwordHash.startsWith("$argon2id$")).toBe(true)
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true)
    await expect(verifyPassword(passwordHash, "autre")).resolves.toBe(false)
  })

  it("applique les coûts configurés et reste vérifiable", async () => {
    const hasher = new PasswordHasher({
      memoryCost: 8_192,
      timeCost: 1,
      parallelism: 1,
    })
    const passwordHash = await hasher.hash("phrase-de-test-seulement")
    expect(passwordHash).toContain("m=8192,t=1,p=1")
    await expect(
      hasher.verify(passwordHash, "phrase-de-test-seulement"),
    ).resolves.toBe(true)
  })

  it("renvoie false pour un hash corrompu au lieu de lever", async () => {
    await expect(new PasswordHasher().verify("pas-un-hash", "x")).resolves.toBe(
      false,
    )
  })

  it("exécute une vérification factice sans compte", async () => {
    await expect(new PasswordHasher().verifyAgainstDummy("x")).resolves.toBe(
      false,
    )
  })
})
