import { Inject, Injectable } from "@nestjs/common"

import {
  isUniqueViolation,
  type Tx,
} from "../../../../database/database.service"
import { Prisma } from "../../../../generated/prisma/client"
import type {
  MessageType,
  ParticipantRole,
} from "../../../../generated/prisma/enums"
import type { Actor } from "../../../identity"
import {
  MEDIA_ATTACHMENT_ACCESS,
  type MediaAttachmentAccess,
} from "../../../media"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import { communicationError } from "../../domain/communication-errors"
import {
  CommunicationEvent,
  RealtimeEvent,
} from "../../domain/communication-events"
import { NotificationService } from "../../notifications/application/notification.service"
import { RealtimePublisher } from "../../realtime/realtime.publisher"
import { serialize } from "../../presentation/serialize"
import {
  MAX_BODY_LENGTH,
  REPEAT_MIN_LENGTH,
  REPEAT_WINDOW_MS,
  messageDedupKey,
  normalizeBody,
  repetitionKey,
  type SystemCode,
} from "../domain/message-rules"
import {
  ConversationRepository,
  messageSelect,
  type ConversationRow,
  type MessageRow,
} from "../infrastructure/conversation.repository"
import {
  ConversationAccessService,
  type ConversationAccessContext,
} from "./conversation-access.service"
import { InquiryService } from "../../inquiries/application/inquiry.service"
import { messageView, type MessageView } from "./messaging-views"

export interface PostInput {
  body: string | null
  /** Identifiants publics des médias envoyés pour cette conversation. */
  attachmentIds: string[]
  clientMessageId?: string
}

interface Recipient {
  userId: bigint
  publicId: string
}

/** Résultat d'un envoi, à publier après le commit. */
export interface PostedMessage {
  conversation: Pick<ConversationRow, "id" | "publicId" | "requesterId">
  message: MessageRow
  duplicate: boolean
  sender: Recipient
  recipients: Recipient[]
}

export interface MessagePage {
  items: MessageView[]
  hasMore: boolean
  lastReadSeq: number
  lastSeq: number
}

const MINUTE_MS = 60_000

/**
 * Messages d'une conversation. Le message est enregistré (et ses
 * notifications mises en file) dans une seule transaction ; la diffusion
 * temps réel et les envois externes viennent après le commit et ne peuvent
 * pas le faire échouer.
 */
@Injectable()
export class MessageService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly access: ConversationAccessService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimePublisher,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
    private readonly inquiries: InquiryService,
    @Inject(MEDIA_ATTACHMENT_ACCESS)
    private readonly media: MediaAttachmentAccess,
  ) {}

  async send(
    actor: Actor,
    conversationPublicId: string,
    input: {
      body?: string | null
      attachmentIds?: string[]
      clientMessageId?: string
    },
  ): Promise<{ message: MessageView; duplicate: boolean }> {
    const started = Date.now()
    const post: PostInput = {
      body: normalizeBody(input.body),
      attachmentIds: [...new Set(input.attachmentIds ?? [])],
      clientMessageId: input.clientMessageId,
    }
    let posted: PostedMessage
    try {
      posted = await this.conversations.transaction(async (tx) => {
        const access = await this.access.resolve(
          actor.userId,
          conversationPublicId,
          tx,
        )
        return this.post(tx, access, actor, post)
      })
    } catch (error) {
      // Deux envois simultanés de la même clé : le second relit le premier.
      if (!post.clientMessageId || !isUniqueViolation(error)) throw error
      posted = await this.replay(
        actor,
        conversationPublicId,
        post.clientMessageId,
      )
    }
    if (!posted.duplicate) {
      this.activity.metrics.communication.persistLatency.observe(
        Date.now() - started,
      )
    }
    return {
      message: await this.publish(posted, actor.userId),
      duplicate: posted.duplicate,
    }
  }

  /**
   * Cœur de l'envoi, dans la transaction de l'appelant (envoi simple ou
   * création de conversation). L'auteur est toujours l'utilisateur
   * authentifié ; le type est déduit du contenu, jamais choisi par le client.
   */
  async post(
    tx: Tx,
    access: ConversationAccessContext,
    actor: Actor,
    input: PostInput,
  ): Promise<PostedMessage> {
    const { conversation } = access
    const sender = { userId: actor.userId, publicId: actor.publicId }
    if (input.clientMessageId) {
      const existing = await this.conversations.findMessageByClientId(
        conversation.id,
        actor.userId,
        input.clientMessageId,
        tx,
      )
      if (existing) {
        return {
          conversation,
          message: existing,
          duplicate: true,
          sender,
          recipients: [],
        }
      }
    }
    if (conversation.status !== "OPEN") {
      throw communicationError("CONVERSATION_CLOSED")
    }
    if (input.body && input.body.length > MAX_BODY_LENGTH) {
      throw communicationError("MESSAGE_INVALID", "message trop long")
    }
    if (!input.body && input.attachmentIds.length === 0) {
      throw communicationError("MESSAGE_INVALID", "message vide")
    }
    if (input.attachmentIds.length > this.config.messaging.maxAttachments) {
      throw communicationError("ATTACHMENT_INVALID", "trop de pièces jointes")
    }
    await this.assertNotFlooding(tx, actor, conversation.id, input.body)

    const attachments = await this.lockAttachments(
      tx,
      conversation.id,
      actor.userId,
      input.attachmentIds,
    )
    const seq = await this.conversations.allocateSeq(conversation.id, tx)
    if (seq === null) throw communicationError("CONVERSATION_CLOSED")

    const type: MessageType =
      attachments.length === 0
        ? "TEXT"
        : attachments.every((row) => row.type === "IMAGE")
          ? "IMAGE"
          : "DOCUMENT"
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        seq,
        authorId: actor.userId,
        type,
        body: input.body,
        clientMessageId: input.clientMessageId ?? null,
      },
      select: { id: true },
    })
    if (attachments.length > 0) {
      await tx.messageAttachment.updateMany({
        where: { id: { in: attachments.map((row) => row.id) } },
        data: { messageId: created.id },
      })
    }
    // L'expéditeur a lu sa conversation ; les autres la voient réapparaître.
    await this.conversations.advanceRead(access.participant.id, seq, tx)
    await tx.conversationParticipant.updateMany({
      where: { conversationId: conversation.id, archivedAt: { not: null } },
      data: { archivedAt: null },
    })
    if (access.side === "LISTING_SIDE" && conversation.inquiryId !== null) {
      await tx.inquiry.updateMany({
        where: { id: conversation.inquiryId, status: "OPEN" },
        data: { status: "IN_PROGRESS" },
      })
      await this.inquiries.markFirstResponse(
        conversation.inquiryId,
        actor.userId,
        tx,
      )
    }

    await this.conversations.syncListingSide(conversation, tx)
    const recipients = await this.notifyRecipients(
      tx,
      conversation,
      actor.userId,
    )
    const message = await tx.message.findUniqueOrThrow({
      where: { id: created.id },
      select: messageSelect,
    })
    return { conversation, message, duplicate: false, sender, recipients }
  }

  /**
   * Message SYSTEM (visite, fermeture) écrit par le backend, dans la
   * transaction de l'opération. L'acteur éventuel a de fait « lu » ce message.
   */
  async appendSystem(
    tx: Tx,
    conversation: Pick<ConversationRow, "id" | "publicId" | "requesterId">,
    code: SystemCode,
    data: Prisma.InputJsonObject,
    actorUserId: bigint | null,
  ): Promise<MessageRow> {
    const seq = await this.conversations.allocateSeq(conversation.id, tx)
    if (seq === null) throw communicationError("CONVERSATION_CLOSED")
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        seq,
        authorId: null,
        type: "SYSTEM",
        systemCode: code,
        data,
      },
      select: messageSelect,
    })
    if (actorUserId !== null) {
      const participant = await this.conversations.findParticipant(
        conversation.id,
        actorUserId,
        tx,
      )
      if (participant) {
        await this.conversations.advanceRead(participant.id, seq, tx)
      }
    }
    return message
  }

  /** Diffuse un message SYSTEM après commit, aux participants actifs. */
  async publishSystem(
    conversation: Pick<ConversationRow, "id" | "publicId" | "requesterId">,
    message: MessageRow,
  ): Promise<void> {
    const participants = await this.conversations.activeParticipants(
      conversation.id,
    )
    const view = await this.viewFor(conversation, message, null)
    this.realtime.toUsers(
      participants.map((row) => row.user.publicId),
      RealtimeEvent.MESSAGE_NEW,
      { conversationId: conversation.publicId, message: serialize(view) },
    )
    await this.emitUnreadCounts(
      conversation,
      participants.map((row) => ({
        userId: row.userId,
        publicId: row.user.publicId,
      })),
    )
  }

  async list(
    actor: Actor,
    conversationPublicId: string,
    query: { before?: number; after?: number; limit?: number },
  ): Promise<MessagePage> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const { conversation, participant } = access
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100)
    const rows = await this.conversations.listMessages(conversation.id, {
      before: query.before,
      after: query.after,
      limit: limit + 1,
    })
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    if (query.after === undefined) page.reverse()

    const [counterpart, media] = await Promise.all([
      this.conversations.counterpartCursors(conversation.id, actor.userId),
      this.media.describeMany(
        page.flatMap((row) => row.attachments.map((item) => item.mediaId)),
      ),
    ])
    const items = page.map((row) =>
      messageView(row, {
        conversationPublicId: conversation.publicId,
        viewerId: actor.userId,
        authorRole: roleResolver(conversation),
        counterpart,
        media,
      }),
    )
    const newest = page.at(-1)?.seq ?? 0
    if (newest > participant.lastDeliveredSeq) {
      await this.acknowledgeDelivered(access, actor, newest)
    }
    return {
      items,
      hasMore,
      lastReadSeq: participant.lastReadSeq,
      lastSeq: conversation.lastSeq,
    }
  }

  /** Accusé de réception (lecture de l'historique ou événement Socket.IO). */
  async markDelivered(
    actor: Actor,
    conversationPublicId: string,
    upToSeq: number,
  ): Promise<{ deliveredSeq: number }> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const seq = Math.min(upToSeq, access.conversation.lastSeq)
    if (seq > access.participant.lastDeliveredSeq) {
      await this.acknowledgeDelivered(access, actor, seq)
      return { deliveredSeq: seq }
    }
    return { deliveredSeq: access.participant.lastDeliveredSeq }
  }

  async markRead(
    actor: Actor,
    conversationPublicId: string,
    upToSeq?: number,
  ): Promise<{ lastReadSeq: number; unread: number }> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const { conversation, participant } = access
    const seq = Math.min(upToSeq ?? conversation.lastSeq, conversation.lastSeq)
    let lastReadSeq = participant.lastReadSeq
    if (seq > participant.lastReadSeq) {
      const moved = await this.conversations.transaction(async (tx) => {
        const advanced = await this.conversations.advanceRead(
          participant.id,
          seq,
          tx,
        )
        if (advanced && seq >= conversation.lastSeq) {
          await this.notifications.markConversationRead(
            actor.userId,
            conversation.publicId,
            tx,
          )
        }
        return advanced
      })
      if (moved) {
        lastReadSeq = seq
        const others = await this.otherParticipants(
          conversation.id,
          actor.userId,
        )
        this.realtime.toUsers(
          others.map((row) => row.publicId),
          RealtimeEvent.MESSAGE_READ,
          {
            conversationId: conversation.publicId,
            userId: actor.publicId,
            readSeq: seq,
          },
        )
      }
    }
    const unread = await this.conversations.unreadCount(
      conversation.id,
      actor.userId,
      lastReadSeq,
    )
    this.realtime.toUsers([actor.publicId], RealtimeEvent.UNREAD_COUNT, {
      conversationId: conversation.publicId,
      unread,
    })
    return { lastReadSeq, unread }
  }

  async viewFor(
    conversation: Pick<ConversationRow, "id" | "publicId" | "requesterId">,
    message: MessageRow,
    viewerId: bigint | null,
  ): Promise<MessageView> {
    const media = await this.media.describeMany(
      message.attachments.map((item) => item.mediaId),
    )
    return messageView(message, {
      conversationPublicId: conversation.publicId,
      viewerId: viewerId ?? -1n,
      authorRole: roleResolver(conversation),
      counterpart: { readSeq: 0, deliveredSeq: 0 },
      media,
    })
  }

  /**
   * Après commit : diffusion aux participants et réveil du worker de
   * livraison. Renvoie la vue de l'expéditeur.
   */
  async publish(posted: PostedMessage, senderId: bigint): Promise<MessageView> {
    const { conversation, message } = posted
    const view = await this.viewFor(conversation, message, senderId)
    if (posted.duplicate) return view
    const shared = await this.viewFor(conversation, message, null)
    this.realtime.toUsers(
      posted.recipients.map((row) => row.publicId),
      RealtimeEvent.MESSAGE_NEW,
      { conversationId: conversation.publicId, message: serialize(shared) },
    )
    this.realtime.toUsers([posted.sender.publicId], RealtimeEvent.MESSAGE_NEW, {
      conversationId: conversation.publicId,
      message: serialize(view),
    })
    await this.emitUnreadCounts(conversation, posted.recipients)

    this.activity.metrics.communication.messagesSent.inc({ type: message.type })
    this.activity.emit(CommunicationEvent.MESSAGE_SENT, conversation.publicId, {
      conversationId: conversation.publicId,
      messageId: message.publicId,
      type: message.type,
    })
    if (posted.recipients.length > 0) {
      this.activity.emit(
        CommunicationEvent.DELIVERIES_QUEUED,
        conversation.publicId,
        {},
      )
    }
    return view
  }

  private async replay(
    actor: Actor,
    conversationPublicId: string,
    clientMessageId: string,
  ): Promise<PostedMessage> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const existing = await this.conversations.findMessageByClientId(
      access.conversation.id,
      actor.userId,
      clientMessageId,
    )
    if (!existing) throw communicationError("MESSAGE_INVALID")
    return {
      conversation: access.conversation,
      message: existing,
      duplicate: true,
      sender: { userId: actor.userId, publicId: actor.publicId },
      recipients: [],
    }
  }

  /**
   * Garde-fous anti-spam, bornés au message en cause : au-delà du débit par
   * minute, ou d'un même texte envoyé à de nombreuses conversations, ce
   * message est refusé (429) sans bloquer le compte.
   */
  private async assertNotFlooding(
    tx: Tx,
    actor: Actor,
    conversationId: bigint,
    body: string | null,
  ): Promise<void> {
    const metrics = this.activity.metrics.communication
    const recent = await this.conversations.countRecentMessages(
      actor.userId,
      new Date(Date.now() - MINUTE_MS),
      tx,
    )
    if (recent >= this.config.messaging.maxMessagesPerMinute) {
      metrics.messagesRejected.inc({ reason: "rate" })
      throw communicationError("MESSAGE_RATE_LIMITED", undefined, 60)
    }
    if (body && body.length >= REPEAT_MIN_LENGTH) {
      const repeated = await this.conversations.countRepeatedBody(
        actor.userId,
        repetitionKey(body),
        new Date(Date.now() - REPEAT_WINDOW_MS),
        conversationId,
        tx,
      )
      if (repeated >= this.config.messaging.repeatLimit) {
        metrics.messagesRejected.inc({ reason: "repeated" })
        this.activity.log("message.repeated_rejected", null, {
          user_id: actor.publicId,
          conversations: repeated,
        })
        throw communicationError("MESSAGE_REPEATED", undefined, 3_600)
      }
    }
  }

  /**
   * Pièces jointes citées : envoyées par l'expéditeur pour cette
   * conversation, prêtes, pas encore rattachées. Verrouillées jusqu'au commit.
   */
  private async lockAttachments(
    tx: Tx,
    conversationId: bigint,
    uploaderId: bigint,
    mediaPublicIds: string[],
  ): Promise<{ id: bigint; type: string }[]> {
    if (mediaPublicIds.length === 0) return []
    const rows = await tx.$queryRaw<
      { id: bigint; type: string; status: string; deleted: boolean }[]
    >`
      SELECT ma.id, m.type::text AS type, m.status::text AS status,
        (m.deleted_at IS NOT NULL) AS deleted
      FROM message_attachments ma
      JOIN media m ON m.id = ma.media_id
      WHERE ma.conversation_id = ${conversationId}
        AND ma.uploader_id = ${uploaderId}
        AND ma.message_id IS NULL
        AND m.public_id::text IN (${Prisma.join(mediaPublicIds)})
      FOR UPDATE OF ma
    `
    if (rows.length !== mediaPublicIds.length) {
      throw communicationError("ATTACHMENT_NOT_FOUND")
    }
    if (rows.some((row) => row.deleted || row.status !== "READY")) {
      throw communicationError("ATTACHMENT_INVALID", "fichier non prêt")
    }
    return rows
  }

  /**
   * Une notification par destinataire et par série non lue (clé de
   * regroupement), sans le contenu du message ; les envois externes sont
   * différés et annulés si le message est lu entre-temps.
   */
  private async notifyRecipients(
    tx: Tx,
    conversation: Pick<ConversationRow, "id" | "publicId" | "listingId">,
    senderId: bigint,
  ): Promise<Recipient[]> {
    const participants = await this.conversations.activeParticipants(
      conversation.id,
      tx,
    )
    const listing = await tx.listing.findUnique({
      where: { id: conversation.listingId },
      select: { publicId: true, title: true },
    })
    const recipients: Recipient[] = []
    for (const participant of participants) {
      if (participant.userId === senderId) continue
      recipients.push({
        userId: participant.userId,
        publicId: participant.user.publicId,
      })
      await this.notifications.notify(
        participant.userId,
        {
          type: "MESSAGE",
          category: "MESSAGES",
          title: "Nouveau message",
          body: listing ? `À propos de « ${listing.title} »` : null,
          data: {
            conversationId: conversation.publicId,
            ...(listing ? { listingId: listing.publicId } : {}),
          },
          dedupKey: messageDedupKey(
            conversation.publicId,
            participant.lastReadSeq,
          ),
          externalDelaySeconds: this.config.messaging.externalDelaySeconds,
          external: !participant.muted,
        },
        tx,
      )
    }
    return recipients
  }

  private async acknowledgeDelivered(
    access: ConversationAccessContext,
    actor: Actor,
    seq: number,
  ): Promise<void> {
    const moved = await this.conversations.advanceDelivered(
      access.participant.id,
      seq,
    )
    if (!moved) return
    const others = await this.otherParticipants(
      access.conversation.id,
      actor.userId,
    )
    this.realtime.toUsers(
      others.map((row) => row.publicId),
      RealtimeEvent.MESSAGE_DELIVERED,
      {
        conversationId: access.conversation.publicId,
        userId: actor.publicId,
        deliveredSeq: seq,
      },
    )
  }

  private async otherParticipants(
    conversationId: bigint,
    userId: bigint,
  ): Promise<Recipient[]> {
    const participants =
      await this.conversations.activeParticipants(conversationId)
    return participants
      .filter((row) => row.userId !== userId)
      .map((row) => ({ userId: row.userId, publicId: row.user.publicId }))
  }

  private async emitUnreadCounts(
    conversation: Pick<ConversationRow, "id" | "publicId">,
    recipients: Recipient[],
  ): Promise<void> {
    if (!this.realtime.active || recipients.length === 0) return
    const participants = await this.conversations.activeParticipants(
      conversation.id,
    )
    const cursor = new Map(
      participants.map((row) => [row.userId, row.lastReadSeq]),
    )
    for (const recipient of recipients) {
      const unread = await this.conversations.unreadCount(
        conversation.id,
        recipient.userId,
        cursor.get(recipient.userId) ?? 0,
      )
      this.realtime.toUsers([recipient.publicId], RealtimeEvent.UNREAD_COUNT, {
        conversationId: conversation.publicId,
        unread,
      })
    }
  }
}

/** Rôle d'un auteur : le client de la conversation, sinon le côté annonce. */
export function roleResolver(
  conversation: Pick<ConversationRow, "requesterId">,
): (authorId: bigint) => ParticipantRole {
  return (authorId) =>
    authorId === conversation.requesterId ? "REQUESTER" : "LISTING_SIDE"
}
