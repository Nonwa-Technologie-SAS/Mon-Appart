import {
  bearer,
  createIdentityApp,
  login,
  NEW_PASSWORD,
  PASSWORD,
  registerUser,
  uniqueEmail,
  uniquePhone,
  type IdentityTestApp,
} from "./identity-app"

describe("Identity : parcours de bout en bout", () => {
  let test: IdentityTestApp

  beforeAll(async () => {
    test = await createIdentityApp()
  })

  afterAll(async () => {
    await test.close()
  })

  it("register → OTP téléphone → login → /me → refresh → logout → refresh refusé", async () => {
    const phone = uniquePhone()
    const register = await test.http
      .post("/api/v1/auth/register")
      .send({
        phone: phone.replace("+225", ""),
        password: PASSWORD,
        firstName: "Awa",
      })
      .expect(201)
    expect(register.body.user).toMatchObject({
      phone,
      status: "PENDING",
      roles: ["CUSTOMER"],
      phoneVerified: false,
    })
    expect(register.body.user).not.toHaveProperty("passwordHash")
    const registrationToken = register.body.accessToken as string

    const challenge = await test.http
      .post("/api/v1/auth/phone/verify/request")
      .set(bearer(registrationToken))
      .expect(202)
    expect(challenge.body.challengeId).toEqual(expect.any(String))
    const code = test.outbox.latest(phone, "verification_code")?.code
    expect(code).toMatch(/^\d{6}$/)

    const stored = await test.db.query<{ code_hash: string }>(
      "SELECT code_hash FROM otp_challenges WHERE public_id = $1",
      [challenge.body.challengeId],
    )
    expect(stored.rows[0]?.code_hash).not.toContain(code)

    const confirm = await test.http
      .post("/api/v1/auth/phone/verify/confirm")
      .set(bearer(registrationToken))
      .send({ code })
      .expect(200)
    expect(confirm.body).toEqual({ verified: true, status: "ACTIVE" })

    const loggedIn = await login(test, phone, PASSWORD).expect(200)
    expect(loggedIn.body).toMatchObject({
      tokenType: "Bearer",
      sessionId: expect.any(String),
    })
    expect(loggedIn.body.refreshToken).toEqual(expect.any(String))

    const session = await test.db.query<{ token_hash: string }>(
      "SELECT token_hash FROM auth_sessions WHERE family_id = $1 AND revoked_at IS NULL",
      [loggedIn.body.sessionId],
    )
    expect(session.rows).toHaveLength(1)
    expect(session.rows[0]?.token_hash).not.toBe(loggedIn.body.refreshToken)

    const me = await test.http
      .get("/api/v1/auth/me")
      .set(bearer(loggedIn.body.accessToken))
      .expect(200)
    expect(me.body).toMatchObject({
      phone,
      status: "ACTIVE",
      phoneVerified: true,
    })

    const refreshed = await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: loggedIn.body.refreshToken })
      .expect(200)
    expect(refreshed.body.refreshToken).not.toBe(loggedIn.body.refreshToken)
    expect(refreshed.body.sessionId).toBe(loggedIn.body.sessionId)

    await test.http
      .post("/api/v1/auth/logout")
      .set(bearer(refreshed.body.accessToken))
      .expect(204)

    const afterLogout = await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401)
    expect(afterLogout.body.code).toBe("SESSION_REVOKED")
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(refreshed.body.accessToken))
      .expect(401)

    const audit = await test.db.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY created_at`,
      [register.body.user.id],
    )
    expect(audit.rows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "USER_REGISTERED",
        "PHONE_VERIFIED",
        "LOGIN_SUCCESS",
        "SESSION_REVOKED",
      ]),
    )
  })

  it("register → forgot-password → reset → ancien mot de passe refusé → nouveau accepté", async () => {
    const user = await registerUser(test)

    const forgot = await test.http
      .post("/api/v1/auth/forgot-password")
      .send({ identifier: user.email.toUpperCase() })
      .expect(202)
    const resetUrl =
      test.outbox.latest(user.email, "password_reset")?.resetUrl ?? ""
    const token = new URL(resetUrl).searchParams.get("token") ?? ""
    expect(token.length).toBeGreaterThan(30)

    const unknown = await test.http
      .post("/api/v1/auth/forgot-password")
      .send({ identifier: uniqueEmail() })
      .expect(202)
    expect(unknown.body).toEqual(forgot.body)

    await test.http
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(200)

    expect((await login(test, user.email, PASSWORD)).status).toBe(401)
    await login(test, user.email, NEW_PASSWORD).expect(200)

    const reused = await test.http
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "encore un autre mot de passe" })
      .expect(400)
    expect(reused.body.code).toBe("RESET_TOKEN_INVALID")

    const revoked = await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken })
      .expect(401)
    expect(revoked.body.code).toBe("SESSION_REVOKED")
  })

  it("vérifie l'email par OTP", async () => {
    const user = await registerUser(test)
    await test.http
      .post("/api/v1/auth/email/verify/request")
      .set(bearer(user.accessToken))
      .expect(202)
    const code = test.outbox.latest(user.email, "verification_code")?.code
    const confirm = await test.http
      .post("/api/v1/auth/email/verify/confirm")
      .set(bearer(user.accessToken))
      .send({ code })
      .expect(200)
    expect(confirm.body.status).toBe("ACTIVE")
    const again = await test.http
      .post("/api/v1/auth/email/verify/request")
      .set(bearer(user.accessToken))
      .expect(409)
    expect(again.body.code).toBe("EMAIL_ALREADY_VERIFIED")
  })

  it("met à jour le profil", async () => {
    const user = await registerUser(test)
    const updated = await test.http
      .patch("/api/v1/auth/me")
      .set(bearer(user.accessToken))
      .send({ firstName: "  Aya ", lastName: "Koné" })
      .expect(200)
    expect(updated.body).toMatchObject({ firstName: "Aya", lastName: "Koné" })
    await test.http
      .patch("/api/v1/auth/me")
      .set(bearer(user.accessToken))
      .send({ email: "pirate@example.test" })
      .expect(400)
  })

  it("change le mot de passe et révoque les autres sessions", async () => {
    const user = await registerUser(test)
    const other = await login(test, user.email, PASSWORD).expect(200)

    const weak = await test.http
      .post("/api/v1/auth/change-password")
      .set(bearer(user.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: "court" })
      .expect(422)
    expect(weak.body.code).toBe("PASSWORD_TOO_WEAK")

    const wrong = await test.http
      .post("/api/v1/auth/change-password")
      .set(bearer(user.accessToken))
      .send({
        currentPassword: "pas le bon mot de passe",
        newPassword: NEW_PASSWORD,
      })
      .expect(422)
    expect(wrong.body.code).toBe("INVALID_CURRENT_PASSWORD")

    const changed = await test.http
      .post("/api/v1/auth/change-password")
      .set(bearer(user.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200)
    expect(changed.body.revokedSessions).toBe(1)

    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(user.accessToken))
      .expect(200)
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(other.body.accessToken))
      .expect(401)
    await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: other.body.refreshToken })
      .expect(401)

    const audit = await test.db.query(
      "SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'PASSWORD_CHANGED'",
      [user.userId],
    )
    expect(audit.rowCount).toBe(1)
  })

  it("liste et révoque les sessions", async () => {
    const user = await registerUser(test)
    const other = await test.http
      .post("/api/v1/auth/login")
      .send({
        identifier: user.phone,
        password: PASSWORD,
        deviceName: "Tablette",
      })
      .expect(200)

    const list = await test.http
      .get("/api/v1/auth/sessions")
      .set(bearer(user.accessToken))
      .expect(200)
    expect(list.body).toHaveLength(2)
    expect(
      list.body.find((session: { current: boolean }) => session.current).id,
    ).toBe(user.sessionId)
    expect(
      list.body.find(
        (session: { id: string }) => session.id === other.body.sessionId,
      ).deviceName,
    ).toBe("Tablette")

    await test.http
      .delete(`/api/v1/auth/sessions/${other.body.sessionId}`)
      .set(bearer(user.accessToken))
      .expect(204)
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(other.body.accessToken))
      .expect(401)
    const missing = await test.http
      .delete(`/api/v1/auth/sessions/${other.body.sessionId}`)
      .set(bearer(user.accessToken))
      .expect(404)
    expect(missing.body.code).toBe("SESSION_NOT_FOUND")
    await test.http
      .delete("/api/v1/auth/sessions/pas-un-uuid")
      .set(bearer(user.accessToken))
      .expect(400)
  })

  it("logout-all révoque toutes les sessions", async () => {
    const user = await registerUser(test)
    const other = await login(test, user.email, PASSWORD).expect(200)
    const result = await test.http
      .post("/api/v1/auth/logout-all")
      .set(bearer(user.accessToken))
      .expect(200)
    expect(result.body.revokedSessions).toBe(2)
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(user.accessToken))
      .expect(401)
    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(other.body.accessToken))
      .expect(401)
    await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: other.body.refreshToken })
      .expect(401)
  })

  it("mode cookie web : refresh HttpOnly + CSRF obligatoire", async () => {
    const email = uniqueEmail()
    const register = await test.http
      .post("/api/v1/auth/register")
      .set("X-Auth-Transport", "cookie")
      .send({ email, password: PASSWORD })
      .expect(201)
    expect(register.body.refreshToken).toBeUndefined()
    const cookies = ([] as string[]).concat(
      register.headers["set-cookie"] ?? [],
    )
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith("ma_refresh="),
    )
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("ma_csrf="))
    expect(refreshCookie).toMatch(/HttpOnly/i)
    expect(refreshCookie).toMatch(/SameSite=Strict/i)
    expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth/)
    expect(csrfCookie).not.toMatch(/HttpOnly/i)
    const csrf = csrfCookie?.split(";")[0]?.split("=")[1] ?? ""
    const cookieHeader = [refreshCookie, csrfCookie]
      .map((cookie) => cookie?.split(";")[0])
      .join("; ")

    const noCsrf = await test.http
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader)
      .expect(403)
    expect(noCsrf.body.code).toBe("CSRF_INVALID")

    const refreshed = await test.http
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookieHeader)
      .set("X-CSRF-Token", csrf)
      .expect(200)
    expect(refreshed.body.refreshToken).toBeUndefined()
    expect(refreshed.body.accessToken).toEqual(expect.any(String))
    expect(
      ([] as string[])
        .concat(refreshed.headers["set-cookie"] ?? [])
        .some((c) => c.startsWith("ma_refresh=")),
    ).toBe(true)
  })
})
