import { JwtService } from "@nestjs/jwt"

import {
  bearer,
  createIdentityApp,
  login,
  PASSWORD,
  registerUser,
  uniqueEmail,
  uniquePhone,
  verifyPhone,
  type IdentityTestApp,
} from "./identity-app"

describe("Identity : sécurité", () => {
  let test: IdentityTestApp

  beforeAll(async () => {
    test = await createIdentityApp()
  })

  afterAll(async () => {
    await test.close()
  })

  describe("inscription", () => {
    it("refuse un email ou un téléphone déjà utilisé (409)", async () => {
      const user = await registerUser(test)
      const email = await test.http
        .post("/api/v1/auth/register")
        .send({ email: user.email.toUpperCase(), password: PASSWORD })
        .expect(409)
      expect(email.body.code).toBe("EMAIL_ALREADY_USED")
      const phone = await test.http
        .post("/api/v1/auth/register")
        .send({ phone: user.phone, password: PASSWORD })
        .expect(409)
      expect(phone.body.code).toBe("PHONE_ALREADY_USED")
    })

    it("résiste aux inscriptions concurrentes sur le même email", async () => {
      const email = uniqueEmail()
      const results = await Promise.all(
        [0, 1, 2].map(() =>
          test.http
            .post("/api/v1/auth/register")
            .send({ email, password: PASSWORD }),
        ),
      )
      expect(results.filter((result) => result.status === 201)).toHaveLength(1)
      expect(results.filter((result) => result.status === 409)).toHaveLength(2)
    })

    it("refuse un mot de passe faible, un téléphone invalide et l'absence de contact", async () => {
      expect(
        (
          await test.http
            .post("/api/v1/auth/register")
            .send({ email: uniqueEmail(), password: "court" })
        ).body.code,
      ).toBe("PASSWORD_TOO_WEAK")
      expect(
        (
          await test.http
            .post("/api/v1/auth/register")
            .send({ phone: "12", password: PASSWORD })
        ).body.code,
      ).toBe("INVALID_PHONE")
      expect(
        (
          await test.http
            .post("/api/v1/auth/register")
            .send({ password: PASSWORD })
        ).body.code,
      ).toBe("CONTACT_REQUIRED")
    })

    it("rejette les champs inconnus (pas d'élévation de rôle)", async () => {
      await test.http
        .post("/api/v1/auth/register")
        .send({ email: uniqueEmail(), password: PASSWORD, roles: ["ADMIN"] })
        .expect(400)
    })
  })

  describe("connexion", () => {
    it("répond pareil pour un compte inconnu et un mauvais mot de passe", async () => {
      const user = await registerUser(test)
      const wrong = await login(
        test,
        user.email,
        "mauvais mot de passe",
      ).expect(401)
      const unknown = await login(test, uniqueEmail(), PASSWORD).expect(401)
      expect(wrong.body.code).toBe("INVALID_CREDENTIALS")
      expect(unknown.body.code).toBe(wrong.body.code)
      expect(unknown.body.message).toBe(wrong.body.message)

      const audit = await test.db.query(
        "SELECT actor_id FROM audit_logs WHERE entity_id = $1 AND action = 'LOGIN_FAILED'",
        [user.userId],
      )
      expect(audit.rows[0]?.actor_id).toBeNull()
    })

    it("bloque temporairement un identifiant après 5 échecs, sans toucher les autres", async () => {
      const victim = await registerUser(test)
      const bystander = await registerUser(test)
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await login(test, victim.email, "mauvais mot de passe").expect(401)
      }
      const locked = await login(test, victim.email, PASSWORD).expect(429)
      expect(locked.body.code).toBe("TOO_MANY_ATTEMPTS")
      expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0)
      await login(test, bystander.email, PASSWORD).expect(200)
    })

    it("refuse un compte suspendu ou banni avec 403", async () => {
      const suspended = await registerUser(test)
      await test.db.query(
        "UPDATE users SET status = 'SUSPENDED' WHERE public_id = $1",
        [suspended.userId],
      )
      expect(
        (await login(test, suspended.email, PASSWORD).expect(403)).body.code,
      ).toBe("ACCOUNT_SUSPENDED")
      const refresh = await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: suspended.refreshToken })
        .expect(403)
      expect(refresh.body.code).toBe("ACCOUNT_SUSPENDED")

      const banned = await registerUser(test)
      await test.db.query(
        "UPDATE users SET status = 'BANNED' WHERE public_id = $1",
        [banned.userId],
      )
      expect(
        (await login(test, banned.email, PASSWORD).expect(403)).body.code,
      ).toBe("ACCOUNT_BANNED")
    })

    it("ne révèle pas le statut sans le bon mot de passe", async () => {
      const banned = await registerUser(test)
      await test.db.query(
        "UPDATE users SET status = 'BANNED' WHERE public_id = $1",
        [banned.userId],
      )
      expect(
        (await login(test, banned.email, "mauvais mot de passe").expect(401))
          .body.code,
      ).toBe("INVALID_CREDENTIALS")
    })

    it("traite un compte supprimé comme inexistant", async () => {
      const deleted = await registerUser(test)
      await test.db.query(
        "UPDATE users SET deleted_at = now() WHERE public_id = $1",
        [deleted.userId],
      )
      await login(test, deleted.email, PASSWORD).expect(401)
      await test.http
        .get("/api/v1/auth/me")
        .set(bearer(deleted.accessToken))
        .expect(401)
      await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: deleted.refreshToken })
        .expect(401)
    })
  })

  describe("jetons", () => {
    it("refuse une requête sans jeton, un jeton forgé et un jeton expiré", async () => {
      expect(
        (await test.http.get("/api/v1/auth/me").expect(401)).body.code,
      ).toBe("UNAUTHENTICATED")

      const user = await registerUser(test)
      const forged = await new JwtService({}).signAsync(
        { sessionId: user.sessionId, roles: ["SUPER_ADMIN"], typ: "access" },
        {
          secret: "secret-de-l-attaquant-de-plus-de-32-car",
          subject: user.userId,
          issuer: "mon-appart-api",
          audience: "mon-appart",
          expiresIn: 60,
        },
      )
      expect(
        (await test.http.get("/api/v1/auth/me").set(bearer(forged)).expect(401))
          .body.code,
      ).toBe("TOKEN_INVALID")

      const expired = await new JwtService({}).signAsync(
        { sessionId: user.sessionId, roles: ["CUSTOMER"], typ: "access" },
        {
          secret: process.env.JWT_SECRET ?? "",
          subject: user.userId,
          issuer: "mon-appart-api",
          audience: "mon-appart",
          expiresIn: -1,
        },
      )
      expect(
        (
          await test.http
            .get("/api/v1/auth/me")
            .set(bearer(expired))
            .expect(401)
        ).body.code,
      ).toBe("TOKEN_EXPIRED")
    })

    it("détecte la réutilisation d'un refresh token et révoque la famille", async () => {
      const user = await registerUser(test)
      const rotated = await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: user.refreshToken })
        .expect(200)
      const replay = await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: user.refreshToken })
        .expect(401)
      expect(replay.body.code).toBe("SESSION_REVOKED")
      await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401)
      await test.http
        .get("/api/v1/auth/me")
        .set(bearer(rotated.body.accessToken))
        .expect(401)

      const audit = await test.db.query(
        "SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'REFRESH_TOKEN_REUSE_DETECTED'",
        [user.sessionId],
      )
      expect(audit.rowCount).toBe(1)
    })

    it("refuse un refresh token expiré", async () => {
      const user = await registerUser(test)
      await test.db.query(
        `UPDATE auth_sessions SET created_at = now() - interval '40 days', expires_at = now() - interval '1 day'
          WHERE family_id = $1`,
        [user.sessionId],
      )
      const expired = await test.http
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: user.refreshToken })
        .expect(401)
      expect(expired.body.code).toBe("TOKEN_EXPIRED")
    })

    it("refuse un jeton de réinitialisation expiré", async () => {
      const user = await registerUser(test)
      await test.http
        .post("/api/v1/auth/forgot-password")
        .send({ identifier: user.phone })
        .expect(202)
      const resetUrl =
        test.outbox.latest(user.phone, "password_reset")?.resetUrl ?? ""
      const token = new URL(resetUrl).searchParams.get("token") ?? ""
      await test.db.query(
        `UPDATE password_reset_tokens SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
          WHERE user_id = (SELECT id FROM users WHERE public_id = $1) AND used_at IS NULL`,
        [user.userId],
      )
      const expired = await test.http
        .post("/api/v1/auth/reset-password")
        .send({ token, newPassword: "une nouvelle phrase solide" })
        .expect(400)
      expect(expired.body.code).toBe("RESET_TOKEN_EXPIRED")
    })
  })

  describe("OTP", () => {
    it("refuse un mauvais code puis bloque après le nombre maximal d'essais", async () => {
      const user = await registerUser(test)
      await test.http
        .post("/api/v1/auth/phone/verify/request")
        .set(bearer(user.accessToken))
        .expect(202)
      const code =
        test.outbox.latest(user.phone, "verification_code")?.code ?? ""
      const wrongCode = code === "000000" ? "111111" : "000000"
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await test.http
          .post("/api/v1/auth/phone/verify/confirm")
          .set(bearer(user.accessToken))
          .send({ code: wrongCode })
          .expect(422)
        expect(response.body.code).toBe("OTP_INVALID")
      }
      const blocked = await test.http
        .post("/api/v1/auth/phone/verify/confirm")
        .set(bearer(user.accessToken))
        .send({ code })
        .expect(429)
      expect(blocked.body.code).toBe("OTP_MAX_ATTEMPTS")
    })

    it("refuse un code expiré", async () => {
      const user = await registerUser(test)
      const challenge = await test.http
        .post("/api/v1/auth/phone/verify/request")
        .set(bearer(user.accessToken))
        .expect(202)
      const code = test.outbox.latest(user.phone, "verification_code")?.code
      await test.db.query(
        `UPDATE otp_challenges SET created_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes'
          WHERE public_id = $1`,
        [challenge.body.challengeId],
      )
      const expired = await test.http
        .post("/api/v1/auth/phone/verify/confirm")
        .set(bearer(user.accessToken))
        .send({ code })
        .expect(422)
      expect(expired.body.code).toBe("OTP_EXPIRED")
    })

    it("refuse la réutilisation d'un code consommé", async () => {
      const user = await registerUser(test)
      await test.http
        .post("/api/v1/auth/email/verify/request")
        .set(bearer(user.accessToken))
        .expect(202)
      const code = test.outbox.latest(user.email, "verification_code")?.code
      await test.http
        .post("/api/v1/auth/email/verify/confirm")
        .set(bearer(user.accessToken))
        .send({ code })
        .expect(200)
      await test.http
        .post("/api/v1/auth/email/verify/confirm")
        .set(bearer(user.accessToken))
        .send({ code })
        .expect(409)
      const row = await test.db.query<{ consumed_at: Date | null }>(
        `SELECT consumed_at FROM otp_challenges
          WHERE user_id = (SELECT id FROM users WHERE public_id = $1) AND purpose = 'EMAIL_VERIFICATION'`,
        [user.userId],
      )
      expect(row.rows[0]?.consumed_at).not.toBeNull()
    })

    it("impose un délai avant un nouvel envoi", async () => {
      const user = await registerUser(test)
      await test.http
        .post("/api/v1/auth/phone/verify/request")
        .set(bearer(user.accessToken))
        .expect(202)
      const again = await test.http
        .post("/api/v1/auth/phone/verify/request")
        .set(bearer(user.accessToken))
        .expect(429)
      expect(again.body.code).toBe("OTP_COOLDOWN")
      expect(Number(again.headers["retry-after"])).toBeGreaterThan(0)
    })

    it("un code n'est valable que pour le compte qui l'a demandé", async () => {
      const owner = await registerUser(test)
      const attacker = await registerUser(test)
      await test.http
        .post("/api/v1/auth/phone/verify/request")
        .set(bearer(owner.accessToken))
        .expect(202)
      const code = test.outbox.latest(owner.phone, "verification_code")?.code
      await test.http
        .post("/api/v1/auth/phone/verify/confirm")
        .set(bearer(attacker.accessToken))
        .send({ code })
        .expect(422)
    })
  })

  describe("énumération", () => {
    it("forgot-password répond 202 identique pour un compte banni, inconnu ou un identifiant invalide", async () => {
      const banned = await registerUser(test)
      await test.db.query(
        "UPDATE users SET status = 'BANNED' WHERE public_id = $1",
        [banned.userId],
      )
      const responses = await Promise.all(
        [banned.email, uniqueEmail(), uniquePhone(), "n'importe quoi"].map(
          (identifier) =>
            test.http.post("/api/v1/auth/forgot-password").send({ identifier }),
        ),
      )
      expect(new Set(responses.map((response) => response.status))).toEqual(
        new Set([202]),
      )
      expect(
        new Set(responses.map((response) => JSON.stringify(response.body)))
          .size,
      ).toBe(1)
      expect(test.outbox.latest(banned.email, "password_reset")).toBeUndefined()
    })
  })

  it("ne permet pas de révoquer la session d'un autre utilisateur", async () => {
    const victim = await registerUser(test)
    const attacker = await registerUser(test)
    const response = await test.http
      .delete(`/api/v1/auth/sessions/${victim.sessionId}`)
      .set(bearer(attacker.accessToken))
      .expect(404)
    expect(response.body.code).toBe("SESSION_NOT_FOUND")
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(victim.accessToken))
      .expect(200)
  })

  it("le compte vérifié reste utilisable après vérification", async () => {
    const user = await registerUser(test)
    await verifyPhone(test, user)
    const me = await test.http
      .get("/api/v1/auth/me")
      .set(bearer(user.accessToken))
      .expect(200)
    expect(me.body.status).toBe("ACTIVE")
  })

  it("n'expose ni stack ni détail interne dans les erreurs", async () => {
    const response = await login(test, "x@example.test", "mauvais").expect(401)
    expect(Object.keys(response.body).sort()).toEqual(
      [
        "code",
        "message",
        "path",
        "requestId",
        "statusCode",
        "timestamp",
      ].sort(),
    )
    expect(JSON.stringify(response.body)).not.toMatch(/stack|prisma|postgres/i)
  })
})
