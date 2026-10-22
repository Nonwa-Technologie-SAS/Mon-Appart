import { JwtService } from "@nestjs/jwt"

import {
  makeConfig,
  makeTokens,
  TEST_SECRETS,
} from "../../testing/identity-test-kit"
import { JWT_AUDIENCE, JWT_ISSUER } from "./access-token.service"

const input = {
  userId: "7d5c1f0e-4c1b-4c1e-9a43-2b8f0b1f0a11",
  sessionId: "0f1e2d3c-4b5a-4968-8776-655443322110",
  roles: ["CUSTOMER" as const],
}

describe("AccessTokenService", () => {
  const tokens = makeTokens()
  const jwt = new JwtService({})

  it("signe puis vérifie un JWT sans donnée sensible", async () => {
    const { token, expiresAt } = await tokens.sign(input)
    const claims = await tokens.verify(token)
    expect(claims).toMatchObject({
      sub: input.userId,
      sessionId: input.sessionId,
      roles: ["CUSTOMER"],
    })
    expect(claims.exp - claims.iat).toBe(15 * 60)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())

    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
    )
    expect(Object.keys(payload).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "roles", "sessionId", "sub", "typ"].sort(),
    )
  })

  it("rejette un jeton expiré avec TOKEN_EXPIRED", async () => {
    const expired = await jwt.signAsync(
      { sessionId: input.sessionId, roles: input.roles, typ: "access" },
      {
        secret: TEST_SECRETS.JWT_SECRET,
        subject: input.userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: -10,
      },
    )
    await expect(tokens.verify(expired)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    })
  })

  it("rejette une signature forgée", async () => {
    const forged = await jwt.signAsync(
      { sessionId: input.sessionId, roles: ["SUPER_ADMIN"], typ: "access" },
      {
        secret: "un-autre-secret-de-plus-de-32-caracteres",
        subject: input.userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: 60,
      },
    )
    await expect(tokens.verify(forged)).rejects.toMatchObject({
      code: "TOKEN_INVALID",
    })
  })

  it("rejette alg=none", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url")
    const body = Buffer.from(
      JSON.stringify({
        sub: input.userId,
        sessionId: input.sessionId,
        roles: ["ADMIN"],
        typ: "access",
      }),
    ).toString("base64url")
    await expect(tokens.verify(`${header}.${body}.`)).rejects.toMatchObject({
      code: "TOKEN_INVALID",
    })
  })

  it("rejette un jeton d'un autre type ou avec un rôle inconnu", async () => {
    const sign = (payload: object) =>
      jwt.signAsync(payload, {
        secret: TEST_SECRETS.JWT_SECRET,
        subject: input.userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: 60,
      })
    await expect(
      tokens.verify(
        await sign({ sessionId: input.sessionId, roles: [], typ: "refresh" }),
      ),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" })
    await expect(
      tokens.verify(
        await sign({
          sessionId: input.sessionId,
          roles: ["ROOT"],
          typ: "access",
        }),
      ),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" })
  })

  it("rejette un jeton signé pour une autre audience", async () => {
    const other = await jwt.signAsync(
      { sessionId: input.sessionId, roles: input.roles, typ: "access" },
      {
        secret: TEST_SECRETS.JWT_SECRET,
        subject: input.userId,
        issuer: JWT_ISSUER,
        audience: "autre",
        expiresIn: 60,
      },
    )
    await expect(tokens.verify(other)).rejects.toMatchObject({
      code: "TOKEN_INVALID",
    })
  })

  it("respecte la durée configurée", async () => {
    const shortLived = makeTokens(makeConfig({ JWT_ACCESS_TTL: "5m" }))
    const claims = await shortLived.verify((await shortLived.sign(input)).token)
    expect(claims.exp - claims.iat).toBe(300)
  })
})
