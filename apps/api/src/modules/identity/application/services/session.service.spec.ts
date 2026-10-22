import { UserStatus } from "../../../../generated/prisma/enums"
import {
  makeActivity,
  makeConfig,
  makeHasher,
  makeTokens,
  noRedis,
} from "../../testing/identity-test-kit"
import type { SessionRecord } from "../../infrastructure/repositories/session.repository"
import type { UserRecord } from "../../infrastructure/repositories/user.repository"
import { SessionRevocationStore } from "../../infrastructure/tokens/session-revocation.store"
import { SessionService } from "./session.service"

type Row = SessionRecord & { tokenHash: string }

/** Dépôt en mémoire reproduisant les verrous optimistes du dépôt Prisma. */
class MemorySessions {
  rows: Row[] = []
  private nextId = 1n

  async create(
    data: Omit<
      Row,
      | "id"
      | "publicId"
      | "lastUsedAt"
      | "revokedAt"
      | "revokedReason"
      | "createdAt"
    >,
  ) {
    const row: Row = {
      ...data,
      id: this.nextId++,
      publicId: `row-${this.nextId}`,
      lastUsedAt: null,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    }
    this.rows.push(row)
    return row
  }
  async findByTokenHash(tokenHash: string) {
    return this.rows.find((row) => row.tokenHash === tokenHash) ?? null
  }
  async markRotated(id: bigint) {
    const row = this.rows.find(
      (candidate) => candidate.id === id && !candidate.revokedAt,
    )
    if (!row) return false
    row.revokedAt = new Date()
    row.revokedReason = "ROTATED"
    return true
  }
  async findActiveInFamily(userId: bigint, familyId: string) {
    return (
      this.rows.find(
        (row) =>
          row.userId === userId &&
          row.familyId === familyId &&
          !row.revokedAt &&
          row.expiresAt > new Date(),
      ) ?? null
    )
  }
  async listActive(userId: bigint) {
    return this.rows.filter((row) => row.userId === userId && !row.revokedAt)
  }
  async revokeFamilies(
    where: { userId: bigint; familyId?: string; exceptFamilyId?: string },
    reason: string,
  ) {
    const targets = this.rows.filter(
      (row) =>
        row.userId === where.userId &&
        !row.revokedAt &&
        (!where.familyId || row.familyId === where.familyId) &&
        (!where.exceptFamilyId || row.familyId !== where.exceptFamilyId),
    )
    for (const row of targets) {
      row.revokedAt = new Date()
      row.revokedReason = reason
    }
    return [...new Set(targets.map((row) => row.familyId))]
  }
}

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 1n,
    publicId: "5f0c8a52-6b0e-4f7e-9a3c-0d1b2c3d4e5f",
    email: "awa@example.com",
    phone: "+2250701020304",
    passwordHash: null,
    firstName: "Awa",
    lastName: null,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    phoneVerifiedAt: new Date(),
    lastLoginAt: null,
    createdAt: new Date(),
    roles: ["CUSTOMER"],
    ...overrides,
  }
}

const context = { ip: "127.0.0.1", userAgent: "vitest", requestId: "req-1" }

function setup(user: UserRecord | null = makeUser()) {
  const config = makeConfig()
  const sessions = new MemorySessions()
  const users = { findById: async () => user }
  const revocations = new SessionRevocationStore(noRedis, config)
  const activity = makeActivity()
  const db = { transaction: <T>(run: (tx: unknown) => Promise<T>) => run({}) }
  const service = new SessionService(
    sessions as never,
    users as never,
    makeTokens(config),
    makeHasher(config),
    revocations,
    config,
    db as never,
    activity,
  )
  return { service, sessions, revocations, activity, config }
}

describe("SessionService", () => {
  it("ouvre une session avec un refresh token stocké sous forme de hash", async () => {
    const { service, sessions } = setup()
    const issued = await service.open(
      makeUser(),
      { deviceName: "Pixel" },
      context,
    )
    expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(sessions.rows).toHaveLength(1)
    expect(sessions.rows[0]?.tokenHash).not.toBe(issued.refreshToken)
    expect(sessions.rows[0]?.familyId).toBe(issued.sessionId)
  })

  it("fait tourner le refresh token et garde la session", async () => {
    const { service, sessions } = setup()
    const first = await service.open(makeUser(), {}, context)
    const second = await service.refresh(first.refreshToken, context)
    expect(second.refreshToken).not.toBe(first.refreshToken)
    expect(second.sessionId).toBe(first.sessionId)
    expect(sessions.rows[0]?.revokedReason).toBe("ROTATED")
    expect(sessions.rows[1]?.revokedAt).toBeNull()
  })

  it("révoque toute la famille si un token tourné est rejoué", async () => {
    const { service, sessions, revocations, activity } = setup()
    const first = await service.open(makeUser(), {}, context)
    const second = await service.refresh(first.refreshToken, context)

    await expect(
      service.refresh(first.refreshToken, context),
    ).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    })
    expect(sessions.rows.every((row) => row.revokedAt !== null)).toBe(true)
    expect(sessions.rows[1]?.revokedReason).toBe("REUSE_DETECTED")
    await expect(revocations.isRevoked(first.sessionId)).resolves.toBe(true)
    await expect(
      service.refresh(second.refreshToken, context),
    ).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    })
    expect(activity.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REFRESH_TOKEN_REUSE_DETECTED" }),
      context,
    )
  })

  it("refuse un token inconnu", async () => {
    const { service } = setup()
    await expect(service.refresh("inconnu", context)).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    })
  })

  it("refuse une session expirée", async () => {
    const { service, sessions } = setup()
    const issued = await service.open(makeUser(), {}, context)
    sessions.rows[0]!.expiresAt = new Date(Date.now() - 1_000)
    await expect(
      service.refresh(issued.refreshToken, context),
    ).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    })
  })

  it("refuse une session révoquée par déconnexion sans déclencher la détection de vol", async () => {
    const { service, activity } = setup()
    const user = makeUser()
    const issued = await service.open(user, {}, context)
    await service.revokeAndPublish(
      user,
      { familyId: issued.sessionId },
      "LOGOUT",
      context,
    )
    await expect(
      service.refresh(issued.refreshToken, context),
    ).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    })
    expect(activity.metrics.auth.refreshReuse.inc).not.toHaveBeenCalled()
  })

  it("refuse le refresh d'un compte suspendu et révoque la session", async () => {
    const user = makeUser({ status: UserStatus.SUSPENDED })
    const { service, sessions } = setup(user)
    const issued = await service.open(user, {}, context)
    await expect(
      service.refresh(issued.refreshToken, context),
    ).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    })
    expect(sessions.rows[0]?.revokedReason).toBe("ACCOUNT_BLOCKED")
  })

  it("refuse le refresh d'un compte supprimé", async () => {
    const { service, sessions } = setup(null)
    const issued = await service.open(makeUser(), {}, context)
    await expect(
      service.refresh(issued.refreshToken, context),
    ).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    })
    expect(sessions.rows[0]?.revokedAt).not.toBeNull()
  })

  it("traite deux rotations concurrentes comme une réutilisation", async () => {
    const { service, sessions } = setup()
    const issued = await service.open(makeUser(), {}, context)
    const results = await Promise.allSettled([
      service.refresh(issued.refreshToken, context),
      service.refresh(issued.refreshToken, context),
    ])
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1)
    expect(sessions.rows.every((row) => row.revokedAt !== null)).toBe(true)
  })
})
