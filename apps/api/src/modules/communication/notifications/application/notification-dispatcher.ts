import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../../../database/database.service"
import type { Prisma } from "../../../../generated/prisma/client"
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
} from "../../../../generated/prisma/enums"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import {
  categoryOf,
  isEnabled,
  planChannels,
  preferenceKey,
} from "../domain/notification-policy"
import { ChannelRegistry } from "../infrastructure/providers/channel-registry"

export interface NotificationInput {
  type: NotificationType
  /** Déduite du type si absente (voir `categoryOf`). */
  category?: NotificationCategory
  /** Écrit par le backend : jamais de contenu de conversation ni de donnée personnelle. */
  title: string
  body?: string | null
  /**
   * Identifiants publics et codes seulement : jamais de note interne, de
   * détail antifraude ni de donnée personnelle.
   */
  data?: Prisma.InputJsonObject
  /** Clé d'idempotence de l'événement : un doublon ne crée rien. */
  dedupKey?: string
  expiresAt?: Date
  /** Délai avant les envois externes (e-mail, SMS, push). */
  externalDelaySeconds?: number
  /** `false` : notification in-app seulement. */
  external?: boolean
}

export interface DispatchResult {
  id: bigint
  publicId: string
  channels: NotificationChannel[]
}

const BLOCKED_STATUSES = new Set(["SUSPENDED", "BANNED", "INACTIVE"])

/**
 * Crée la notification et ses livraisons dans la transaction de l'opération
 * métier (outbox) : l'opération et ses notifications sont validées ensemble,
 * et aucun appel externe n'a lieu ici. Le worker (`DeliveryRunner`) envoie
 * ensuite chaque livraison, avec reprises ; un échec d'envoi n'annule jamais
 * l'opération ni l'enregistrement d'un message.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly db: DatabaseService,
    private readonly channels: ChannelRegistry,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
  ) {}

  async notify(
    userId: bigint,
    input: NotificationInput,
    db: Db = this.db.client,
  ): Promise<DispatchResult | null> {
    const category = input.category ?? categoryOf(input.type)
    // Séquentiel : `db` peut être une transaction interactive.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        deletedAt: true,
        emailVerifiedAt: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
      },
    })
    if (!user || user.deletedAt) return null
    const stored = await db.notificationPreference.findMany({
      where: { userId, category },
      select: { category: true, channel: true, enabled: true },
    })
    const activePushDevices = await db.pushDevice.count({
      where: { userId, invalidatedAt: null },
    })

    const preferences = new Map(
      stored.map((row) => [
        preferenceKey(row.category, row.channel),
        row.enabled,
      ]),
    )
    const inApp = isEnabled(category, "IN_APP", preferences)
    const external =
      input.external === false || BLOCKED_STATUSES.has(user.status)
        ? []
        : planChannels({
            category,
            stored: preferences,
            available: this.channels.available(),
            contact: {
              emailVerified: Boolean(user.email && user.emailVerifiedAt),
              phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
              activePushDevices,
            },
            fallbacks: this.config.fallbacks,
          })
    if (!inApp && external.length === 0) return null

    const data = JSON.stringify(input.data ?? {})
    const rows = await db.$queryRaw<{ id: bigint; public_id: string }[]>`
      INSERT INTO notifications
        (user_id, type, category, title, body, data, dedup_key, expires_at)
      VALUES (
        ${userId},
        ${input.type}::notification_type,
        ${category}::notification_category,
        ${input.title.slice(0, 200)},
        ${input.body?.slice(0, 2000) ?? null},
        ${data}::jsonb,
        ${input.dedupKey?.slice(0, 200) ?? null},
        ${input.expiresAt ?? null}::timestamptz
      )
      ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
      RETURNING id, public_id::text AS public_id
    `
    const created = rows[0]
    if (!created) return null

    const now = Date.now()
    const delayed = new Date(now + (input.externalDelaySeconds ?? 0) * 1_000)
    const planned: NotificationChannel[] = [
      ...(inApp ? (["IN_APP"] as const) : []),
      ...external,
    ]
    await db.notificationDelivery.createMany({
      data: planned.map((channel) => ({
        notificationId: created.id,
        channel,
        nextAttemptAt: channel === "IN_APP" ? new Date(now) : delayed,
      })),
    })
    this.activity.metrics.communication.notificationsCreated.inc({ category })
    return { id: created.id, publicId: created.public_id, channels: planned }
  }
}
