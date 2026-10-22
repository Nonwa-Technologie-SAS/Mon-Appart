import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import type { ParticipantSide } from "../domain/message-rules"

export const conversationSelect = {
  id: true,
  publicId: true,
  type: true,
  status: true,
  requesterId: true,
  listingId: true,
  propertyId: true,
  inquiryId: true,
  lastSeq: true,
  lastMessageAt: true,
  lastActivityAt: true,
  closedAt: true,
  createdAt: true,
} as const satisfies Prisma.ConversationSelect

export type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect
}>

export const participantSelect = {
  id: true,
  userId: true,
  role: true,
  state: true,
  lastReadSeq: true,
  lastDeliveredSeq: true,
  archivedAt: true,
  muted: true,
} as const satisfies Prisma.ConversationParticipantSelect

export type ParticipantRow = Prisma.ConversationParticipantGetPayload<{
  select: typeof participantSelect
}>

export const peopleSelect = {
  publicId: true,
  firstName: true,
  lastName: true,
} as const satisfies Prisma.UserSelect

export const messageSelect = {
  id: true,
  publicId: true,
  seq: true,
  type: true,
  body: true,
  systemCode: true,
  data: true,
  authorId: true,
  createdAt: true,
  deletedAt: true,
  author: { select: peopleSelect },
  attachments: {
    orderBy: { id: "asc" },
    select: { id: true, mediaId: true },
  },
} as const satisfies Prisma.MessageSelect

export type MessageRow = Prisma.MessageGetPayload<{
  select: typeof messageSelect
}>

export interface ConversationListRow {
  id: bigint
  last_activity_at: Date
  unread: number
}

/**
 * Accès PostgreSQL de la messagerie. L'appartenance « côté annonce » est
 * toujours relue dans `property_ownerships` (rattachements courants) : un
 * participant enregistré ne vaut jamais autorisation à lui seul.
 */
@Injectable()
export class ConversationRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.transaction(run)
  }

  findByPublicId(publicId: string, db: Db = this.client) {
    return db.conversation.findUnique({
      where: { publicId },
      select: conversationSelect,
    })
  }

  findForRequester(listingId: bigint, requesterId: bigint, db: Db) {
    return db.conversation.findFirst({
      where: { listingId, requesterId },
      select: conversationSelect,
    })
  }

  /** Gestionnaires courants du bien, du plus ancien rattachement au plus récent. */
  async currentManagerIds(propertyId: bigint, db: Db = this.client) {
    const rows = await db.propertyOwnership.findMany({
      where: { propertyId, isCurrent: true },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      select: { ownerId: true },
    })
    return rows.map((row) => row.ownerId)
  }

  async isCurrentManager(
    propertyId: bigint,
    userId: bigint,
    db: Db = this.client,
  ): Promise<boolean> {
    const row = await db.propertyOwnership.findFirst({
      where: { propertyId, ownerId: userId, isCurrent: true },
      select: { id: true },
    })
    return row !== null
  }

  findParticipant(
    conversationId: bigint,
    userId: bigint,
    db: Db = this.client,
  ) {
    return db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: participantSelect,
    })
  }

  /** Crée ou réactive la participation (un gestionnaire revenu sur le bien). */
  ensureParticipant(
    conversationId: bigint,
    userId: bigint,
    side: ParticipantSide,
    db: Db,
  ) {
    return db.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, role: side },
      update: { state: "ACTIVE", leftAt: null, role: side },
      select: participantSelect,
    })
  }

  async markLeft(conversationId: bigint, userIds: bigint[], db: Db) {
    if (userIds.length === 0) return
    await db.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: { in: userIds },
        role: "LISTING_SIDE",
        state: "ACTIVE",
      },
      data: { state: "LEFT", leftAt: new Date() },
    })
  }

  /**
   * Aligne le côté annonce sur les gestionnaires courants : les nouveaux
   * entrent, ceux qui ne gèrent plus le bien passent à LEFT (plus d'accès).
   */
  async syncListingSide(
    conversation: Pick<ConversationRow, "id" | "propertyId">,
    db: Db,
  ): Promise<bigint[]> {
    const managers = await this.currentManagerIds(conversation.propertyId, db)
    const existing = await db.conversationParticipant.findMany({
      where: { conversationId: conversation.id, role: "LISTING_SIDE" },
      select: { userId: true, state: true },
    })
    const current = new Set(managers)
    const active = new Set(
      existing.filter((row) => row.state === "ACTIVE").map((row) => row.userId),
    )
    for (const userId of managers) {
      if (!active.has(userId)) {
        await this.ensureParticipant(
          conversation.id,
          userId,
          "LISTING_SIDE",
          db,
        )
      }
    }
    await this.markLeft(
      conversation.id,
      [...active].filter((userId) => !current.has(userId)),
      db,
    )
    return managers
  }

  activeParticipants(conversationId: bigint, db: Db = this.client) {
    return db.conversationParticipant.findMany({
      where: { conversationId, state: "ACTIVE" },
      orderBy: { id: "asc" },
      select: { ...participantSelect, user: { select: peopleSelect } },
    })
  }

  /**
   * Numéro du prochain message, sous le verrou de ligne de la conversation :
   * séquence sans trou ni doublon. `null` si la conversation est fermée.
   */
  async allocateSeq(conversationId: bigint, db: Db): Promise<number | null> {
    const rows = await db.$queryRaw<{ last_seq: number }[]>`
      UPDATE conversations
      SET last_seq = last_seq + 1,
          last_message_at = now(),
          last_activity_at = now()
      WHERE id = ${conversationId} AND status = 'OPEN'
      RETURNING last_seq
    `
    return rows[0]?.last_seq ?? null
  }

  findMessageByClientId(
    conversationId: bigint,
    authorId: bigint,
    clientMessageId: string,
    db: Db = this.client,
  ) {
    return db.message.findUnique({
      where: {
        conversationId_authorId_clientMessageId: {
          conversationId,
          authorId,
          clientMessageId,
        },
      },
      select: messageSelect,
    })
  }

  /** Messages envoyés par l'auteur depuis `since`, toutes conversations. */
  countRecentMessages(authorId: bigint, since: Date, db: Db = this.client) {
    return db.message.count({
      where: { authorId, createdAt: { gte: since } },
    })
  }

  /**
   * Conversations distinctes où l'auteur a envoyé ce même texte (casse et
   * espaces ignorés) depuis `since`. Le texte n'est ni journalisé ni stocké
   * ailleurs.
   */
  async countRepeatedBody(
    authorId: bigint,
    key: string,
    since: Date,
    excludeConversationId: bigint,
    db: Db = this.client,
  ): Promise<number> {
    const rows = await db.$queryRaw<{ count: number }[]>`
      SELECT count(DISTINCT conversation_id)::int AS count
      FROM messages
      WHERE author_id = ${authorId}
        AND created_at >= ${since}
        AND type <> 'SYSTEM'
        AND conversation_id <> ${excludeConversationId}
        AND lower(regexp_replace(btrim(body), '\\s+', ' ', 'g')) = ${key}
    `
    return rows[0]?.count ?? 0
  }

  countConversationsStarted(
    requesterId: bigint,
    since: Date,
    db: Db = this.client,
  ) {
    return db.conversation.count({
      where: { requesterId, createdAt: { gte: since } },
    })
  }

  /** Messages non lus d'un participant (ses propres messages exclus). */
  async unreadCount(
    conversationId: bigint,
    userId: bigint,
    lastReadSeq: number,
    db: Db = this.client,
  ): Promise<number> {
    return db.message.count({
      where: {
        conversationId,
        seq: { gt: lastReadSeq },
        deletedAt: null,
        OR: [{ authorId: null }, { authorId: { not: userId } }],
      },
    })
  }

  /** Total des messages non lus sur les conversations accessibles. */
  async totalUnread(userId: bigint): Promise<number> {
    const rows = await this.client.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM conversation_participants p
      JOIN messages m
        ON m.conversation_id = p.conversation_id AND m.seq > p.last_read_seq
      WHERE p.user_id = ${userId}
        AND p.state = 'ACTIVE'
        AND m.deleted_at IS NULL
        AND m.author_id IS DISTINCT FROM ${userId}
    `
    return rows[0]?.count ?? 0
  }

  /**
   * Conversations visibles : celles que j'ai ouvertes, et celles des biens
   * que je gère aujourd'hui. Pagination par (last_activity_at, id).
   */
  listVisible(
    userId: bigint,
    options: {
      archived: boolean
      pivot: { lastActivityAt: Date; id: bigint } | null
      limit: number
    },
  ): Promise<ConversationListRow[]> {
    // Sans ligne de participation (gestionnaire pas encore inscrit), la
    // conversation n'est pas archivée.
    const archived = options.archived
      ? Prisma.sql`p.archived_at IS NOT NULL`
      : Prisma.sql`(p.id IS NULL OR p.archived_at IS NULL)`
    const after = options.pivot
      ? Prisma.sql`AND (c.last_activity_at, c.id) < (${options.pivot.lastActivityAt}, ${options.pivot.id})`
      : Prisma.empty
    return this.client.$queryRaw<ConversationListRow[]>`
      SELECT c.id, c.last_activity_at,
        (
          SELECT count(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.seq > COALESCE(p.last_read_seq, 0)
            AND m.deleted_at IS NULL
            AND m.author_id IS DISTINCT FROM ${userId}
        ) AS unread
      FROM conversations c
      LEFT JOIN conversation_participants p
        ON p.conversation_id = c.id AND p.user_id = ${userId}
      WHERE (
          c.requester_id = ${userId}
          OR c.property_id IN (
            SELECT po.property_id FROM property_ownerships po
            WHERE po.owner_id = ${userId} AND po.is_current
          )
        )
        AND ${archived}
        ${after}
      ORDER BY c.last_activity_at DESC, c.id DESC
      LIMIT ${options.limit}
    `
  }

  /** Détails d'affichage d'une page de conversations, dans l'ordre demandé. */
  async hydrate(ids: bigint[]) {
    if (ids.length === 0) return []
    const rows = await this.client.conversation.findMany({
      where: { id: { in: ids } },
      select: {
        ...conversationSelect,
        listing: {
          select: {
            publicId: true,
            title: true,
            listingType: true,
            status: true,
          },
        },
        requester: { select: peopleSelect },
        participants: {
          where: { state: "ACTIVE" },
          orderBy: { id: "asc" },
          select: { ...participantSelect, user: { select: peopleSelect } },
        },
        messages: {
          orderBy: { seq: "desc" },
          take: 1,
          select: messageSelect,
        },
      },
    })
    const byId = new Map(rows.map((row) => [row.id, row]))
    return ids.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  }

  listMessages(
    conversationId: bigint,
    options: { before?: number; after?: number; limit: number },
  ) {
    const ascending = options.after !== undefined
    return this.client.message.findMany({
      where: {
        conversationId,
        ...(options.after !== undefined
          ? { seq: { gt: options.after } }
          : options.before !== undefined
            ? { seq: { lt: options.before } }
            : {}),
      },
      orderBy: { seq: ascending ? "asc" : "desc" },
      take: options.limit,
      select: messageSelect,
    })
  }

  findMessage(conversationId: bigint, publicId: string, db: Db = this.client) {
    return db.message.findFirst({
      where: { conversationId, publicId },
      select: messageSelect,
    })
  }

  /** Curseurs de lecture et de réception les plus avancés des autres participants. */
  async counterpartCursors(
    conversationId: bigint,
    userId: bigint,
  ): Promise<{ readSeq: number; deliveredSeq: number }> {
    const result = await this.client.conversationParticipant.aggregate({
      where: { conversationId, userId: { not: userId }, state: "ACTIVE" },
      _max: { lastReadSeq: true, lastDeliveredSeq: true },
    })
    return {
      readSeq: result._max.lastReadSeq ?? 0,
      deliveredSeq: result._max.lastDeliveredSeq ?? 0,
    }
  }

  /** Avance le curseur de réception (jamais en arrière) ; `true` s'il a bougé. */
  async advanceDelivered(participantId: bigint, seq: number): Promise<boolean> {
    const result = await this.client.conversationParticipant.updateMany({
      where: { id: participantId, lastDeliveredSeq: { lt: seq } },
      data: { lastDeliveredSeq: seq },
    })
    return result.count > 0
  }

  /** Avance le curseur de lecture (et de réception) ; `true` s'il a bougé. */
  async advanceRead(
    participantId: bigint,
    seq: number,
    db: Db = this.client,
  ): Promise<boolean> {
    const result = await db.$executeRaw`
      UPDATE conversation_participants
      SET last_read_seq = ${seq},
          last_read_at = now(),
          last_delivered_seq = GREATEST(last_delivered_seq, ${seq})
      WHERE id = ${participantId} AND last_read_seq < ${seq}
    `
    return result > 0
  }
}
