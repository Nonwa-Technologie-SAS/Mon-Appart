import { Injectable } from "@nestjs/common"

import { IdentityDatabase, type Db } from "../persistence/identity-database"

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly db: IdentityDatabase) {}

  /** Un seul lien valide à la fois par utilisateur. */
  async replace(
    userId: bigint,
    tokenHash: string,
    expiresAt: Date,
    db: Db,
  ): Promise<void> {
    await db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
    await db.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    })
  }

  findByHash(tokenHash: string, db: Db = this.db.client) {
    return db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    })
  }

  async consume(id: bigint, db: Db): Promise<boolean> {
    const result = await db.passwordResetToken.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    return result.count === 1
  }

  async invalidateAll(userId: bigint, db: Db): Promise<void> {
    await db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }
}
