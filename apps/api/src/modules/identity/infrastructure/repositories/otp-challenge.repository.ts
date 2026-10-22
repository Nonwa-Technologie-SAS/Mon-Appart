import { Injectable } from "@nestjs/common"

import type { OtpChannel, OtpPurpose } from "../../../../generated/prisma/enums"
import { IdentityDatabase, type Db } from "../persistence/identity-database"

export interface OtpChallengeRecord {
  id: bigint
  publicId: string
  userId: bigint | null
  channel: OtpChannel
  purpose: OtpPurpose
  destinationHash: string
  codeHash: string
  attempts: number
  maxAttempts: number
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

@Injectable()
export class OtpChallengeRepository {
  constructor(private readonly db: IdentityDatabase) {}

  findLatest(
    userId: bigint,
    purpose: OtpPurpose,
    db: Db = this.db.client,
  ): Promise<OtpChallengeRecord | null> {
    return db.otpChallenge.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: "desc" },
    })
  }

  findForUser(
    userId: bigint,
    purpose: OtpPurpose,
    publicId: string | undefined,
    db: Db = this.db.client,
  ): Promise<OtpChallengeRecord | null> {
    return db.otpChallenge.findFirst({
      where: {
        userId,
        purpose,
        ...(publicId ? { publicId } : { consumedAt: null }),
      },
      orderBy: { createdAt: "desc" },
    })
  }

  /** Les anciens codes encore valides deviennent inutilisables. */
  async supersedeActive(
    userId: bigint,
    purpose: OtpPurpose,
    db: Db,
  ): Promise<void> {
    await db.otpChallenge.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    })
  }

  create(
    data: {
      publicId: string
      userId: bigint
      channel: OtpChannel
      purpose: OtpPurpose
      destinationHash: string
      codeHash: string
      maxAttempts: number
      expiresAt: Date
    },
    db: Db,
  ): Promise<OtpChallengeRecord> {
    return db.otpChallenge.create({ data })
  }

  /** Incrément atomique ; `false` si le défi est consommé ou épuisé entre-temps. */
  async registerAttempt(
    challenge: OtpChallengeRecord,
    db: Db = this.db.client,
  ): Promise<boolean> {
    const result = await db.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        attempts: { lt: challenge.maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    })
    return result.count === 1
  }

  /** Consommation unique : une seule requête concurrente peut réussir. */
  async consume(id: bigint, db: Db): Promise<boolean> {
    const result = await db.otpChallenge.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    return result.count === 1
  }
}
