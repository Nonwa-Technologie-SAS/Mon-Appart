import { Injectable } from "@nestjs/common"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import { DatabaseService, type Db } from "../../../../database/database.service"
import type {
  NotificationCategory,
  NotificationType,
} from "../../../../generated/prisma/enums"
import { communicationError } from "../../domain/communication-errors"
import {
  NotificationDispatcher,
  type DispatchResult,
  type NotificationInput,
} from "./notification-dispatcher"

export type { NotificationInput } from "./notification-dispatcher"

export interface NotificationView {
  id: string
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string | null
  data: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const notificationSelect = {
  id: true,
  publicId: true,
  type: true,
  category: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const

/**
 * Notifications in-app (historique en base) et point d'entrée des autres
 * modules : `notify` s'exécute dans la transaction de l'opération métier et
 * met en file les envois externes autorisés (voir `NotificationDispatcher`).
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  notify(
    userId: bigint,
    input: NotificationInput,
    db: Db = this.db.client,
  ): Promise<DispatchResult | null> {
    return this.dispatcher.notify(userId, input, db)
  }

  async list(
    userId: bigint,
    options: { unreadOnly?: boolean; cursor?: string; limit?: number },
  ): Promise<{
    items: NotificationView[]
    nextCursor: string | null
    unread: number
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
    let pivot: { id: bigint; createdAt: Date } | null = null
    if (options.cursor) {
      const payload = decodeCursor(options.cursor)
      if (!payload || !UUID_PATTERN.test(payload.id)) {
        throw communicationError("INVALID_CURSOR")
      }
      pivot = await this.db.client.notification.findFirst({
        where: { publicId: payload.id, userId },
        select: { id: true, createdAt: true },
      })
      if (!pivot) return { items: [], nextCursor: null, unread: 0 }
    }
    const now = new Date()
    const [rows, unread] = await Promise.all([
      this.db.client.notification.findMany({
        where: {
          userId,
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            ...(pivot
              ? [
                  {
                    OR: [
                      { createdAt: { lt: pivot.createdAt } },
                      { createdAt: pivot.createdAt, id: { lt: pivot.id } },
                    ],
                  },
                ]
              : []),
          ],
          ...(options.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: notificationSelect,
      }),
      this.unreadCount(userId),
    ])
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map(toNotificationView),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              id: last.publicId,
              createdAt: last.createdAt.toISOString(),
            })
          : null,
      unread,
    }
  }

  unreadCount(userId: bigint): Promise<number> {
    return this.db.client.notification.count({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
  }

  /** Idempotent ; la notification d'un autre utilisateur est introuvable (404). */
  async markRead(userId: bigint, publicId: string): Promise<NotificationView> {
    const row = await this.db.client.notification.findFirst({
      where: { publicId, userId },
      select: notificationSelect,
    })
    if (!row) throw communicationError("NOTIFICATION_NOT_FOUND")
    if (row.readAt) return toNotificationView(row)
    const updated = await this.db.client.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
      select: notificationSelect,
    })
    return toNotificationView(updated)
  }

  async markAllRead(userId: bigint): Promise<number> {
    const result = await this.db.client.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return result.count
  }

  /** Notifications d'une conversation lues avec elle (clé `conversation:{id}:…`). */
  async markConversationRead(
    userId: bigint,
    conversationPublicId: string,
    db: Db = this.db.client,
  ): Promise<number> {
    const result = await db.notification.updateMany({
      where: {
        userId,
        readAt: null,
        dedupKey: { startsWith: `conversation:${conversationPublicId}:` },
      },
      data: { readAt: new Date() },
    })
    return result.count
  }
}

export function toNotificationView(row: {
  publicId: string
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string | null
  data: unknown
  readAt: Date | null
  createdAt: Date
}): NotificationView {
  return {
    id: row.publicId,
    type: row.type,
    category: row.category,
    title: row.title,
    body: row.body,
    data:
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {},
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}
