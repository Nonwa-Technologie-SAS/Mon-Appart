import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import {
  makeConfig,
  makeTokens,
  noRedis,
} from "../../testing/identity-test-kit"
import { SessionRevocationStore } from "../../infrastructure/tokens/session-revocation.store"
import {
  IS_PUBLIC_KEY,
  OPTIONAL_AUTH_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from "../decorators/auth.decorators"
import { extractBearer, JwtAuthGuard } from "./jwt-auth.guard"
import { PermissionsGuard } from "./permissions.guard"
import { RolesGuard } from "./roles.guard"

function contextFor(
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
) {
  const handler = () => undefined
  for (const [key, value] of Object.entries(metadata))
    Reflect.defineMetadata(key, value, handler)
  return {
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe("JwtAuthGuard", () => {
  const config = makeConfig()
  const tokens = makeTokens(config)
  const revocations = new SessionRevocationStore(noRedis, config)
  const guard = new JwtAuthGuard(new Reflector(), tokens, revocations)
  const claims = {
    userId: "8a8f3f1e-1b2c-4d5e-8f90-123456789abc",
    sessionId: "1b2c3d4e-5f60-4718-9a0b-c1d2e3f4a5b6",
    roles: ["CUSTOMER" as const],
  }

  it("laisse passer une route publique", async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} }, { [IS_PUBLIC_KEY]: true })),
    ).resolves.toBe(true)
  })

  it("refuse une requête sans jeton", async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    })
  })

  it("attache l'utilisateur pour un jeton valide", async () => {
    const { token } = await tokens.sign(claims)
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    }
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true)
    expect(request.user).toEqual({
      id: claims.userId,
      sessionId: claims.sessionId,
      roles: ["CUSTOMER"],
    })
  })

  it("refuse un jeton dont la session est révoquée", async () => {
    const { token } = await tokens.sign({
      ...claims,
      sessionId: "9c8b7a6f-5e4d-4c3b-8a29-1f0e0d0c0b0a",
    })
    await revocations.revoke(["9c8b7a6f-5e4d-4c3b-8a29-1f0e0d0c0b0a"])
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toMatchObject({ code: "SESSION_REVOKED" })
  })

  describe("route @OptionalAuth()", () => {
    const optional = { [IS_PUBLIC_KEY]: true, [OPTIONAL_AUTH_KEY]: true }

    it("reconnaît l'utilisateur d'un jeton valide", async () => {
      const { token } = await tokens.sign(claims)
      const request: Record<string, unknown> = {
        headers: { authorization: `Bearer ${token}` },
      }
      await expect(
        guard.canActivate(contextFor(request, optional)),
      ).resolves.toBe(true)
      expect(request.user).toMatchObject({ id: claims.userId })
    })

    it("traite un jeton invalide comme un visiteur anonyme", async () => {
      const request: Record<string, unknown> = {
        headers: { authorization: "Bearer pas-un-jwt" },
      }
      await expect(
        guard.canActivate(contextFor(request, optional)),
      ).resolves.toBe(true)
      expect(request.user).toBeUndefined()
    })

    it("n'attache rien sur une route seulement publique", async () => {
      const { token } = await tokens.sign(claims)
      const request: Record<string, unknown> = {
        headers: { authorization: `Bearer ${token}` },
      }
      await guard.canActivate(contextFor(request, { [IS_PUBLIC_KEY]: true }))
      expect(request.user).toBeUndefined()
    })
  })

  it("n'accepte que le schéma Bearer", () => {
    expect(extractBearer("Bearer abc")).toBe("abc")
    expect(extractBearer("Basic abc")).toBeNull()
    expect(extractBearer("Bearer a b")).toBeNull()
    expect(extractBearer(undefined)).toBeNull()
  })
})

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector())
  const withRoles = (roles: string[], required: string[]) =>
    contextFor(
      { user: { id: "u", sessionId: "s", roles } },
      { [ROLES_KEY]: required },
    )

  it("autorise un rôle attendu", () => {
    expect(
      guard.canActivate(withRoles(["ADMIN"], ["ADMIN", "MODERATOR"])),
    ).toBe(true)
  })

  it("refuse un rôle insuffisant avec 403", () => {
    expect(() => guard.canActivate(withRoles(["CUSTOMER"], ["ADMIN"]))).toThrow(
      expect.objectContaining({ code: "INSUFFICIENT_ROLE" }),
    )
  })

  it("laisse passer SUPER_ADMIN", () => {
    expect(guard.canActivate(withRoles(["SUPER_ADMIN"], ["MODERATOR"]))).toBe(
      true,
    )
  })

  it("ignore une route sans contrainte", () => {
    expect(guard.canActivate(contextFor({}))).toBe(true)
  })
})

describe("PermissionsGuard", () => {
  const rbac = {
    permissionsFor: async (roles: string[]) =>
      new Set(
        roles.includes("MODERATOR")
          ? ["listing:suspend", "user:read"]
          : ["property:read"],
      ),
  }
  const guard = new PermissionsGuard(new Reflector(), rbac as never)
  const withPermissions = (roles: string[], required: string[]) =>
    contextFor(
      { user: { id: "u", sessionId: "s", roles } },
      { [PERMISSIONS_KEY]: required },
    )

  it("exige toutes les permissions", async () => {
    await expect(
      guard.canActivate(
        withPermissions(["MODERATOR"], ["listing:suspend", "user:read"]),
      ),
    ).resolves.toBe(true)
    await expect(
      guard.canActivate(
        withPermissions(["MODERATOR"], ["listing:suspend", "user:suspend"]),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSION" })
  })

  it("refuse un client sans la permission", async () => {
    await expect(
      guard.canActivate(withPermissions(["CUSTOMER"], ["listing:suspend"])),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_PERMISSION",
    })
  })

  it("laisse passer SUPER_ADMIN", async () => {
    await expect(
      guard.canActivate(withPermissions(["SUPER_ADMIN"], ["user:suspend"])),
    ).resolves.toBe(true)
  })
})
