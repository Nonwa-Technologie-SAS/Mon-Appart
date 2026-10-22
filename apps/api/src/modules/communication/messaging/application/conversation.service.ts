import { Inject, Injectable } from "@nestjs/common"
import { decodeCursor, encodeCursor } from "@mon-appart/validation"

import {
  isUniqueViolation,
  type Tx,
} from "../../../../database/database.service"
import type { Actor, ClientContext } from "../../../identity"
import {
  MEDIA_ATTACHMENT_ACCESS,
  type DownloadLink,
  type MediaAttachmentAccess,
  type MessageUploadInput,
  type UploadSessionView,
} from "../../../media"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import { communicationError } from "../../domain/communication-errors"
import {
  CONVERSATION_ENTITY,
  CommunicationAuditAction,
  CommunicationEvent,
  RealtimeEvent,
} from "../../domain/communication-events"
import { RealtimePublisher } from "../../realtime/realtime.publisher"
import { MAX_BODY_LENGTH, normalizeBody } from "../domain/message-rules"
import {
  ConversationRepository,
  type ConversationRow,
} from "../infrastructure/conversation.repository"
import {
  ConversationAccessService,
  type ConversationAccessContext,
} from "./conversation-access.service"
import {
  MessageService,
  roleResolver,
  type PostedMessage,
} from "./message.service"
import {
  conversationView,
  messageView,
  personView,
  type ConversationView,
  type MessageView,
} from "./messaging-views"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOUR_MS = 60 * 60 * 1000
const MAX_PENDING_ATTACHMENTS = 10
/** Annonces encore privées : introuvables pour un tiers. */
const HIDDEN_LISTING_STATUSES = new Set(["DRAFT", "PENDING_REVIEW"])

export interface StartConversationInput {
  listingId: string
  message: string
  clientMessageId?: string
}

/** Annonce contactable, et ce qu'il faut pour ouvrir une conversation. */
export interface ContactableListing {
  id: bigint
  publicId: string
  propertyId: bigint
  title: string
  managers: bigint[]
  /** Interlocuteur principal : le publieur s'il gère encore le bien. */
  ownerId: bigint
}

/**
 * Conversations liées à une annonce, entre un client et le côté annonce
 * (gestionnaires courants du bien). Une seule conversation par client et par
 * annonce ; pas de conversation libre ni de groupe.
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly access: ConversationAccessService,
    private readonly messages: MessageService,
    private readonly realtime: RealtimePublisher,
    private readonly activity: CommunicationActivity,
    private readonly config: CommunicationConfig,
    @Inject(MEDIA_ATTACHMENT_ACCESS)
    private readonly media: MediaAttachmentAccess,
  ) {}

  /**
   * Contacter l'annonceur. Reprend la conversation existante s'il y en a une
   * (le message y est ajouté) ; sinon crée demande de contact, conversation
   * et premier message dans une seule transaction.
   */
  async start(
    actor: Actor,
    input: StartConversationInput,
    client: ClientContext,
  ): Promise<{
    conversation: ConversationView
    message: MessageView
    created: boolean
  }> {
    const body = normalizeBody(input.message)
    if (!body || body.length > MAX_BODY_LENGTH) {
      throw communicationError("MESSAGE_INVALID")
    }
    const listing = await this.contactableListing(input.listingId, actor.userId)

    const existing = await this.conversations.findForRequester(
      listing.id,
      actor.userId,
      this.conversations.client,
    )
    if (existing) {
      return this.continueExisting(actor, existing, body, input.clientMessageId)
    }
    const since = new Date(Date.now() - HOUR_MS)
    const started = await this.conversations.countConversationsStarted(
      actor.userId,
      since,
    )
    if (started >= this.config.messaging.maxConversationsPerHour) {
      this.activity.metrics.communication.messagesRejected.inc({
        reason: "conversation_rate",
      })
      throw communicationError("CONVERSATION_RATE_LIMITED", undefined, 3_600)
    }

    let posted: PostedMessage
    try {
      posted = await this.conversations.transaction(async (tx) => {
        const access = await this.open(
          tx,
          actor,
          listing,
          "PROPERTY_INQUIRY",
          "MESSAGE",
        )
        await this.activity.audit(
          {
            action: CommunicationAuditAction.CONVERSATION_CREATED,
            actorId: actor.userId,
            entityType: CONVERSATION_ENTITY,
            entityId: access.conversation.publicId,
            newValues: {
              listingId: listing.publicId,
              type: access.conversation.type,
            },
          },
          client,
          tx,
        )
        return this.messages.post(tx, access, actor, {
          body,
          attachmentIds: [],
          clientMessageId: input.clientMessageId,
        })
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Deux premiers messages simultanés : la conversation existe désormais.
      const winner = await this.conversations.findForRequester(
        listing.id,
        actor.userId,
        this.conversations.client,
      )
      if (!winner) throw error
      return this.continueExisting(actor, winner, body, input.clientMessageId)
    }

    const message = await this.messages.publish(posted, actor.userId)
    this.activity.metrics.communication.conversationsCreated.inc({
      type: "PROPERTY_INQUIRY",
    })
    this.activity.emit(
      CommunicationEvent.CONVERSATION_CREATED,
      posted.conversation.publicId,
      {
        conversationId: posted.conversation.publicId,
        listingId: listing.publicId,
      },
    )
    return {
      conversation: await this.get(actor, posted.conversation.publicId),
      message,
      created: true,
    }
  }

  /**
   * Annonce publiée, bien non supprimé, au moins un gestionnaire, et
   * l'appelant n'en est pas un. Partagé avec les demandes de visite.
   */
  async contactableListing(
    listingPublicId: string,
    userId: bigint,
  ): Promise<ContactableListing> {
    const listing = await this.conversations.client.listing.findFirst({
      where: { publicId: listingPublicId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        propertyId: true,
        createdById: true,
        status: true,
        title: true,
        property: { select: { deletedAt: true } },
      },
    })
    if (
      !listing ||
      listing.property.deletedAt ||
      HIDDEN_LISTING_STATUSES.has(listing.status)
    ) {
      throw communicationError("LISTING_NOT_FOUND")
    }
    const managers = await this.conversations.currentManagerIds(
      listing.propertyId,
    )
    if (managers.includes(userId)) {
      throw communicationError("CANNOT_CONTACT_OWN_LISTING")
    }
    if (listing.status !== "PUBLISHED" || managers.length === 0) {
      throw communicationError("LISTING_NOT_CONTACTABLE")
    }
    return {
      id: listing.id,
      publicId: listing.publicId,
      propertyId: listing.propertyId,
      title: listing.title,
      managers,
      ownerId: managers.includes(listing.createdById)
        ? listing.createdById
        : managers[0]!,
    }
  }

  /**
   * Ouvre la conversation (et sa demande de contact) dans la transaction de
   * l'appelant, avec le client et les gestionnaires courants comme participants.
   */
  async open(
    tx: Tx,
    actor: Actor,
    listing: ContactableListing,
    type: "PROPERTY_INQUIRY" | "VISIT_COORDINATION",
    inquiryType: "MESSAGE" | "REQUEST_VISIT",
  ): Promise<ConversationAccessContext> {
    // Le contenu vit dans la conversation : la demande n'en garde pas copie.
    const inquiry = await tx.inquiry.create({
      data: {
        userId: actor.userId,
        propertyId: listing.propertyId,
        listingId: listing.id,
        ownerId: listing.ownerId,
        type: inquiryType,
        message: null,
      },
      select: { id: true },
    })
    const conversation = await tx.conversation.create({
      data: {
        type,
        requesterId: actor.userId,
        listingId: listing.id,
        propertyId: listing.propertyId,
        inquiryId: inquiry.id,
      },
      select: {
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
      },
    })
    const participant = await this.conversations.ensureParticipant(
      conversation.id,
      actor.userId,
      "REQUESTER",
      tx,
    )
    for (const managerId of listing.managers) {
      await this.conversations.ensureParticipant(
        conversation.id,
        managerId,
        "LISTING_SIDE",
        tx,
      )
    }
    return { conversation, side: "REQUESTER", participant }
  }

  async list(
    actor: Actor,
    query: { archived?: boolean; cursor?: string; limit?: number },
  ): Promise<{ items: ConversationView[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50)
    let pivot: { lastActivityAt: Date; id: bigint } | null = null
    if (query.cursor) {
      const payload = decodeCursor(query.cursor)
      const at = payload ? new Date(payload.createdAt) : null
      if (!payload || !UUID_PATTERN.test(payload.id) || !at || isNaN(+at)) {
        throw communicationError("INVALID_CURSOR")
      }
      const row = await this.conversations.findByPublicId(payload.id)
      if (!row) return { items: [], nextCursor: null }
      pivot = { lastActivityAt: at, id: row.id }
    }
    const rows = await this.conversations.listVisible(actor.userId, {
      archived: query.archived ?? false,
      pivot,
      limit: limit + 1,
    })
    const page = rows.slice(0, limit)
    const items = await this.views(
      actor,
      page.map((row) => row.id),
      new Map(page.map((row) => [row.id, row.unread])),
    )
    const last = items.at(-1)
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              id: last.id,
              createdAt: last.lastActivityAt.toISOString(),
            })
          : null,
    }
  }

  async get(
    actor: Actor,
    conversationPublicId: string,
  ): Promise<ConversationView> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const unread = await this.conversations.unreadCount(
      access.conversation.id,
      actor.userId,
      access.participant.lastReadSeq,
    )
    const [view] = await this.views(
      actor,
      [access.conversation.id],
      new Map([[access.conversation.id, unread]]),
    )
    if (!view) throw communicationError("CONVERSATION_NOT_FOUND")
    return view
  }

  totalUnread(actor: Actor): Promise<number> {
    return this.conversations.totalUnread(actor.userId)
  }

  async setArchived(
    actor: Actor,
    conversationPublicId: string,
    archived: boolean,
  ): Promise<ConversationView> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    await this.conversations.client.conversationParticipant.update({
      where: { id: access.participant.id },
      data: { archivedAt: archived ? new Date() : null },
    })
    this.realtime.toUsers(
      [actor.publicId],
      RealtimeEvent.CONVERSATION_UPDATED,
      {
        conversationId: access.conversation.publicId,
        archived,
      },
    )
    return this.get(actor, conversationPublicId)
  }

  async setMuted(
    actor: Actor,
    conversationPublicId: string,
    muted: boolean,
  ): Promise<ConversationView> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    await this.conversations.client.conversationParticipant.update({
      where: { id: access.participant.id },
      data: { muted },
    })
    return this.get(actor, conversationPublicId)
  }

  /**
   * Ouvre l'envoi d'une pièce jointe privée (pipeline Media), réservée à
   * cette conversation et à son expéditeur jusqu'à l'envoi du message.
   */
  async startAttachmentUpload(
    actor: Actor,
    conversationPublicId: string,
    input: MessageUploadInput,
    client: ClientContext,
  ): Promise<UploadSessionView> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const { conversation } = access
    if (conversation.status !== "OPEN") {
      throw communicationError("CONVERSATION_CLOSED")
    }
    const pending = await this.conversations.client.messageAttachment.count({
      where: {
        conversationId: conversation.id,
        uploaderId: actor.userId,
        messageId: null,
        media: { deletedAt: null },
      },
    })
    if (pending >= MAX_PENDING_ATTACHMENTS) {
      throw communicationError("TOO_MANY_PENDING_ATTACHMENTS")
    }
    return this.media.createMessageUpload(
      actor,
      input,
      client,
      async (tx, media) => {
        await tx.messageAttachment.create({
          data: {
            conversationId: conversation.id,
            mediaId: media.id,
            uploaderId: actor.userId,
          },
        })
        await this.activity.audit(
          {
            action: CommunicationAuditAction.ATTACHMENT_UPLOAD_STARTED,
            actorId: actor.userId,
            entityType: CONVERSATION_ENTITY,
            entityId: conversation.publicId,
            newValues: { mediaId: media.publicId, type: input.type },
          },
          client,
          tx,
        )
      },
    )
  }

  /** Lien de lecture court, pour un participant, d'une pièce jointe envoyée. */
  async attachmentLink(
    actor: Actor,
    conversationPublicId: string,
    messagePublicId: string,
    mediaPublicId: string,
    client: ClientContext,
  ): Promise<DownloadLink> {
    const access = await this.access.resolve(actor.userId, conversationPublicId)
    const message = await this.conversations.findMessage(
      access.conversation.id,
      messagePublicId,
    )
    if (!message || message.deletedAt) {
      throw communicationError("MESSAGE_NOT_FOUND")
    }
    const media = await this.media.describeMany(
      message.attachments.map((item) => item.mediaId),
    )
    const target = [...media.values()].find(
      (info) => info.mediaId === mediaPublicId,
    )
    if (!target) throw communicationError("ATTACHMENT_NOT_FOUND")
    const link = await this.media.createAttachmentLink(target.id, {
      userId: actor.userId,
      requestId: client.requestId,
    })
    if (!link) throw communicationError("ATTACHMENT_NOT_FOUND")
    return link
  }

  private async continueExisting(
    actor: Actor,
    conversation: ConversationRow,
    body: string,
    clientMessageId: string | undefined,
  ) {
    if (conversation.status !== "OPEN") {
      throw communicationError("CONVERSATION_CLOSED")
    }
    const { message } = await this.messages.send(actor, conversation.publicId, {
      body,
      clientMessageId,
    })
    return {
      conversation: await this.get(actor, conversation.publicId),
      message,
      created: false,
    }
  }

  private async views(
    actor: Actor,
    ids: bigint[],
    unread: Map<bigint, number>,
  ): Promise<ConversationView[]> {
    const rows = await this.conversations.hydrate(ids)
    const media = await this.media.describeMany(
      rows.flatMap((row) =>
        row.messages.flatMap((message) =>
          message.attachments.map((item) => item.mediaId),
        ),
      ),
    )
    return rows.map((row) => {
      const mine = row.participants.find((item) => item.userId === actor.userId)
      const side =
        row.requesterId === actor.userId ? "REQUESTER" : "LISTING_SIDE"
      const others = row.participants.filter(
        (item) => item.userId !== actor.userId,
      )
      const counterpart = {
        readSeq: Math.max(0, ...others.map((item) => item.lastReadSeq)),
        deliveredSeq: Math.max(
          0,
          ...others.map((item) => item.lastDeliveredSeq),
        ),
      }
      const last = row.messages[0]
      return conversationView(
        { ...row, listing: { ...row.listing, id: row.listing.publicId } },
        {
          side,
          participant: mine ?? null,
          participants: others.map((item) => personView(item.user, item.role)),
          lastMessage: last
            ? messageView(last, {
                conversationPublicId: row.publicId,
                viewerId: actor.userId,
                authorRole: roleResolver(row),
                counterpart,
                media,
              })
            : null,
          unread: unread.get(row.id) ?? 0,
        },
      )
    })
  }
}
