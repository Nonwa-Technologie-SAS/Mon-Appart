import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../../database/database.service"
import type { Prisma } from "../../../../generated/prisma/client"
import type { NotificationChannel } from "../../../../generated/prisma/enums"

export interface ClaimedDelivery {
  id: bigint
  attempt: number
}

export const deliverySelect = {
  id: true,
  publicId: true,
  channel: true,
  status: true,
  attempts: true,
  fallbackFromId: true,
  notification: {
    select: {
      id: true,
      publicId: true,
      type: true,
      category: true,
      title: true,
      body: true,
      data: true,
      readAt: true,
      expiresAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          publicId: true,
          status: true,
          deletedAt: true,
          email: true,
          emailVerifiedAt: true,
          phone: true,
          phoneVerifiedAt: true,
        },
      },
    },
  },
} satisfies Prisma.NotificationDeliverySelect

export type DeliveryRow = Prisma.NotificationDeliveryGetPayload<{
  select: typeof deliverySelect
}>

/**
 * File des livraisons portée par `notification_deliveries.next_attempt_at`.
 * `SKIP LOCKED` : deux workers ne prennent jamais la même livraison ; le
 * compteur d'essais sert de jeton, et un bail expiré rend la livraison à la
 * file (worker arrêté en cours d'envoi).
 */
@Injectable()
export class DeliveryRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  async claim(limit: number, leaseSeconds: number): Promise<ClaimedDelivery[]> {
    const rows = await this.db.client.$queryRaw<
      { id: bigint; attempts: number }[]
    >`
      UPDATE notification_deliveries
      SET status = 'SENDING',
          attempts = attempts + 1,
          next_attempt_at = now() + ${leaseSeconds}::int * interval '1 second'
      WHERE id IN (
        SELECT id FROM notification_deliveries
        WHERE next_attempt_at <= now()
          AND status IN ('PENDING', 'SENDING')
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, attempts
    `
    return rows.map((row) => ({ id: row.id, attempt: Number(row.attempts) }))
  }

  load(id: bigint): Promise<DeliveryRow | null> {
    return this.db.client.notificationDelivery.findUnique({
      where: { id },
      select: deliverySelect,
    })
  }

  /** Termine une livraison seulement si ce worker la détient encore. */
  async finish(
    job: ClaimedDelivery,
    data: Prisma.NotificationDeliveryUncheckedUpdateManyInput,
  ): Promise<boolean> {
    const result = await this.db.client.notificationDelivery.updateMany({
      where: { id: job.id, status: "SENDING", attempts: job.attempt },
      data,
    })
    return result.count === 1
  }

  /** Repli : ignoré si le canal a déjà une livraison pour cette notification. */
  async insertFallback(
    notificationId: bigint,
    channel: NotificationChannel,
    fallbackFromId: bigint,
  ): Promise<boolean> {
    const result = await this.db.client.notificationDelivery.createMany({
      data: [
        { notificationId, channel, fallbackFromId, nextAttemptAt: new Date() },
      ],
      skipDuplicates: true,
    })
    return result.count === 1
  }

  countPending(): Promise<number> {
    return this.db.client.notificationDelivery.count({
      where: { nextAttemptAt: { not: null } },
    })
  }

  activePushTokens(userId: bigint) {
    return this.db.client.pushDevice.findMany({
      where: { userId, invalidatedAt: null },
      select: { id: true, token: true },
      orderBy: { lastSeenAt: "desc" },
      take: 10,
    })
  }

  invalidatePushTokens(userId: bigint, tokens: string[]) {
    return this.db.client.pushDevice.updateMany({
      where: { userId, token: { in: tokens }, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    })
  }

  preferences(
    userId: bigint,
    category: DeliveryRow["notification"]["category"],
  ) {
    return this.db.client.notificationPreference.findMany({
      where: { userId, category },
      select: { category: true, channel: true, enabled: true },
    })
  }
}
