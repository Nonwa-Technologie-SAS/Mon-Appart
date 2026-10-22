import { Controller, Get } from "@nestjs/common"

import {
  AccountAdminService,
  Permissions,
  Roles,
} from "../../src/modules/identity"
import {
  bearer,
  createIdentityApp,
  login,
  PASSWORD,
  registerUser,
  type IdentityTestApp,
} from "./identity-app"

@Controller({ path: "probe", version: "1" })
class ProbeController {
  @Get("moderation")
  @Roles("MODERATOR")
  moderation() {
    return { ok: true }
  }

  @Get("suspend")
  @Permissions("user:suspend")
  suspend() {
    return { ok: true }
  }
}

describe("Identity : RBAC et administration", () => {
  let test: IdentityTestApp
  let admin: AccountAdminService

  beforeAll(async () => {
    test = await createIdentityApp({}, [ProbeController])
    admin = test.app.get(AccountAdminService)
  })

  afterAll(async () => {
    await test.close()
  })

  it("refuse un rôle ou une permission insuffisants (403)", async () => {
    const customer = await registerUser(test)
    const role = await test.http
      .get("/api/v1/probe/moderation")
      .set(bearer(customer.accessToken))
      .expect(403)
    expect(role.body.code).toBe("INSUFFICIENT_ROLE")
    const permission = await test.http
      .get("/api/v1/probe/suspend")
      .set(bearer(customer.accessToken))
      .expect(403)
    expect(permission.body.code).toBe("INSUFFICIENT_PERMISSION")
    await test.http.get("/api/v1/probe/moderation").expect(401)
  })

  it("change un rôle et l'audite dans la même transaction", async () => {
    const actor = await registerUser(test)
    const target = await registerUser(test)
    await admin.changeRole(
      actor.userId,
      target.userId,
      "MODERATOR",
      "grant",
      null,
    )

    // Les rôles du JWT sont relus au prochain login ou refresh.
    const relogged = await login(test, target.email, PASSWORD).expect(200)
    expect(relogged.body.user.roles.sort()).toEqual(["CUSTOMER", "MODERATOR"])
    await test.http
      .get("/api/v1/probe/moderation")
      .set(bearer(relogged.body.accessToken))
      .expect(200)

    const audit = await test.db.query<{
      new_values: { role: string; operation: string }
    }>(
      "SELECT new_values FROM audit_logs WHERE entity_id = $1 AND action = 'ROLE_CHANGED'",
      [target.userId],
    )
    expect(audit.rows[0]?.new_values).toEqual({
      operation: "grant",
      role: "MODERATOR",
    })
  })

  it("suspend un compte : statut, sessions révoquées et audit", async () => {
    const actor = await registerUser(test)
    const target = await registerUser(test)
    await admin.setStatus(
      actor.userId,
      target.userId,
      "SUSPENDED",
      "fraude signalée",
      null,
    )

    await test.http
      .get("/api/v1/auth/me")
      .set(bearer(target.accessToken))
      .expect(401)
    const refresh = await test.http
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: target.refreshToken })
      .expect(401)
    expect(refresh.body.code).toBe("SESSION_REVOKED")
    expect(
      (await login(test, target.email, PASSWORD).expect(403)).body.code,
    ).toBe("ACCOUNT_SUSPENDED")

    const audit = await test.db.query(
      "SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'ACCOUNT_SUSPENDED'",
      [target.userId],
    )
    expect(audit.rowCount).toBe(1)
  })
})
