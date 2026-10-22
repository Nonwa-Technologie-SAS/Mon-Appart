import { Injectable } from "@nestjs/common"

import type { SessionRevocationReason } from "../../domain/identity-events"
import { IdentityDatabase, type Db } from "../persistence/identity-database"

export interface SessionRecord {
  id: bigint
  publicId: string
  userId: bigint
  familyId: string
  deviceId: string | null
  deviceName: string | null
  ipAddress: string | null
  userAgent: string | null
  lastUsedAt: Date | null
  expiresAt: Date
  revokedAt: Date | null
  revokedReason: string | null
  createdAt: Date
}

const sessionSelect = {
  id: true,
  publicId: true,
  userId: true,
  familyId: true,
  deviceId: true,
  deviceName: true,
  ipAddress: true,
  userAgent: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  createdAt: true,
} as const

@Injectable()
export class SessionRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async create(
    data: {
      userId: bigint
      familyId: string
      tokenHash: string
      deviceId: string | null
      deviceName: string | null
      ipAddress: string | null
      userAgent: string | null
      expiresAt: Date
    },
    db: Db = this.db.client,
  ): Promise<SessionRecord> {
    return db.authSession.create({ data, select: sessionSelect })
  }

  findByTokenHash(
    tokenHash: string,
    db: Db = this.db.client,
  ): Promise<SessionRecord | null> {
    return db.authSession.findUnique({
      where: { tokenHash },
      select: sessionSelect,
    })
  }

  /** Révoque la ligne seulement si elle est encore active (verrou optimiste). */
  async markRotated(id: bigint, db: Db): Promise<boolean> {
    const now = new Date()
    const result = await db.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now, revokedReason: "ROTATED", lastUsedAt: now },
    })
    return result.count === 1
  }

  async findActiveInFamily(
    userId: bigint,
    familyId: string,
    db: Db = this.db.client,
  ): Promise<SessionRecord | null> {
    return db.authSession.findFirst({
      where: {
        userId,
        familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: sessionSelect,
    })
  }

  listActive(
    userId: bigint,
    db: Db = this.db.client,
  ): Promise<SessionRecord[]> {
    return db.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: sessionSelect,
      orderBy: { createdAt: "desc" },
    })
  }

  /** Révoque les lignes actives des familles ciblées ; renvoie les familles touchées. */
  async revokeFamilies(
    where: { userId: bigint; familyId?: string; exceptFamilyId?: string },
    reason: SessionRevocationReason,
    db: Db = this.db.client,
  ): Promise<string[]> {
    const filter = {
      userId: where.userId,
      revokedAt: null,
      ...(where.familyId ? { familyId: where.familyId } : {}),
      ...(where.exceptFamilyId
        ? { NOT: { familyId: where.exceptFamilyId } }
        : {}),
    }
    const active = await db.authSession.findMany({
      where: filter,
      select: { familyId: true },
      distinct: ["familyId"],
    })
    if (active.length === 0) return []
    await db.authSession.updateMany({
      where: filter,
      data: { revokedAt: new Date(), revokedReason: reason },
    })
    return active.map((row) => row.familyId)
  }
}
