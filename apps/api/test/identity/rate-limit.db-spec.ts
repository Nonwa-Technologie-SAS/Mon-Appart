import {
  createIdentityApp,
  PASSWORD,
  uniqueEmail,
  type IdentityTestApp,
} from "./identity-app"

describe("Identity : limites par IP", () => {
  let test: IdentityTestApp

  beforeAll(async () => {
    test = await createIdentityApp({
      registerRateLimit: 2,
      loginRateLimit: 3,
      resetRateLimit: 2,
    })
  })

  afterAll(async () => {
    await test.close()
  })

  it("limite les inscriptions par IP", async () => {
    for (let index = 0; index < 2; index += 1) {
      await test.http
        .post("/api/v1/auth/register")
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(201)
    }
    const limited = await test.http
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(429)
    expect(limited.body.code).toBe("RATE_LIMITED")
  })

  it("limite les tentatives de connexion par IP, tous identifiants confondus", async () => {
    for (let index = 0; index < 3; index += 1) {
      await test.http
        .post("/api/v1/auth/login")
        .send({ identifier: uniqueEmail(), password: PASSWORD })
        .expect(401)
    }
    const limited = await test.http
      .post("/api/v1/auth/login")
      .send({ identifier: uniqueEmail(), password: PASSWORD })
      .expect(429)
    expect(limited.body.code).toBe("RATE_LIMITED")
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0)
  })

  it("limite les demandes de réinitialisation par IP", async () => {
    for (let index = 0; index < 2; index += 1) {
      await test.http
        .post("/api/v1/auth/forgot-password")
        .send({ identifier: uniqueEmail() })
        .expect(202)
    }
    await test.http
      .post("/api/v1/auth/forgot-password")
      .send({ identifier: uniqueEmail() })
      .expect(429)
  })
})
