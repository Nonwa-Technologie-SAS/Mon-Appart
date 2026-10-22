import { Injectable } from "@nestjs/common"

import type { Tx } from "../../../../database/database.service"
import type { ParticipantRole } from "../../../../generated/prisma/enums"
import { CommunicationActivity } from "../../communication-activity"
import { communicationError } from "../../domain/communication-errors"
import {
  CONVERSATION_ENTITY,
  CommunicationAuditAction,
  CommunicationEvent,
} from "../../domain/communication-events"
import { SystemCode } from "../domain/message-rules"
import { ConversationRepository } from "../infrastructure/conversation.repository"
import { ConversationAccessService } from "./conversation-access.service"
import { MessageService, roleResolver } from "./message.service"

export interface ReportableConversation {
  conversationId: bigint
  conversationPublicId: string
  messageId: bigint | null
  messagePublicId: string | null
  /** Auteur du message signalé, ou interlocuteur(s) de la conversation. */
  reportedUserIds: bigint[]
}

export interface ModerationExcerptMessage {
  id: string
  seq: number
  type: string
  body: string | null
  systemCode: string | null
  authorRole: ParticipantRole | "SYSTEM"
  authorId: string | null
  attachments: number
  reported: boolean
  createdAt: Date
}

const EXCERPT_SIZE = 20

/**
 * Contrat offert à la modération (module Trust). Un modérateur ne parcourt
 * jamais les conversations : il ne voit que l'extrait attaché à un
 * signalement (le message visé, ou les derniers messages de la conversation).
 */
@Injectable()
export class ConversationModerationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly access: ConversationAccessService,
    private readonly messages: MessageService,
    private readonly activity: CommunicationActivity,
  ) {}

  /** Seul un participant peut signaler ; un message SYSTEM ou le sien, non. */
  async resolveReportTarget(
    userId: bigint,
    conversationPublicId: string,
    messagePublicId: string | null,
  ): Promise<ReportableConversation> {
    const { conversation } = await this.access.resolve(
      userId,
      conversationPublicId,
    )
    const participants = await this.conversations.activeParticipants(
      conversation.id,
    )
    if (!messagePublicId) {
      const others = new Set(
        participants.map((row) => row.userId).filter((id) => id !== userId),
      )
      if (
        conversation.requesterId !== null &&
        conversation.requesterId !== userId
      ) {
        others.add(conversation.requesterId)
      }
      return {
        conversationId: conversation.id,
        conversationPublicId: conversation.publicId,
        messageId: null,
        messagePublicId: null,
        reportedUserIds: [...others],
      }
    }
    const message = await this.conversations.findMessage(
      conversation.id,
      messagePublicId,
    )
    if (!message) throw communicationError("MESSAGE_NOT_FOUND")
    if (message.type === "SYSTEM" || message.authorId === userId) {
      throw communicationError("MESSAGE_INVALID", "message non signalable")
    }
    return {
      conversationId: conversation.id,
      conversationPublicId: conversation.publicId,
      messageId: message.id,
      messagePublicId: message.publicId,
      reportedUserIds: message.authorId === null ? [] : [message.authorId],
    }
  }

  /** Extrait limité au signalement : le message visé, ou les 20 derniers. */
  async excerpt(
    conversationId: bigint,
    messageId: bigint | null,
  ): Promise<ModerationExcerptMessage[]> {
    const conversation =
      await this.conversations.client.conversation.findUnique({
        where: { id: conversationId },
        select: { requesterId: true },
      })
    if (!conversation) return []
    const rows = await this.conversations.client.message.findMany({
      where: messageId ? { id: messageId } : { conversationId },
      orderBy: { seq: "desc" },
      take: messageId ? 1 : EXCERPT_SIZE,
      select: {
        id: true,
        publicId: true,
        seq: true,
        type: true,
        body: true,
        systemCode: true,
        authorId: true,
        createdAt: true,
        author: { select: { publicId: true } },
        _count: { select: { attachments: true } },
      },
    })
    const role = roleResolver(conversation)
    return rows.reverse().map((row) => ({
      id: row.publicId,
      seq: row.seq,
      type: row.type,
      body: row.body,
      systemCode: row.systemCode,
      authorRole:
        row.type === "SYSTEM" || row.authorId === null
          ? "SYSTEM"
          : role(row.authorId),
      authorId: row.author?.publicId ?? null,
      attachments: row._count.attachments,
      reported: messageId !== null && row.id === messageId,
      createdAt: row.createdAt,
    }))
  }

  /**
   * Ferme la conversation (lecture seule) dans la transaction de la décision
   * de modération, avec un message SYSTEM sans motif détaillé. Renvoie la
   * diffusion à exécuter après le commit.
   */
  async close(
    tx: Tx,
    conversationId: bigint,
    moderatorId: bigint,
    reportPublicId: string,
  ): Promise<() => Promise<void>> {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, publicId: true, requesterId: true, status: true },
    })
    if (!conversation || conversation.status === "CLOSED") {
      return async () => undefined
    }
    const message = await this.messages.appendSystem(
      tx,
      conversation,
      SystemCode.CONVERSATION_CLOSED,
      {},
      null,
    )
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { status: "CLOSED", closedAt: new Date() },
    })
    await this.activity.audit(
      {
        action: CommunicationAuditAction.CONVERSATION_CLOSED,
        actorId: moderatorId,
        entityType: CONVERSATION_ENTITY,
        entityId: conversation.publicId,
        newValues: { reportId: reportPublicId },
      },
      null,
      tx,
    )
    return async () => {
      await this.messages.publishSystem(conversation, message)
      this.activity.emit(
        CommunicationEvent.CONVERSATION_CLOSED,
        conversation.publicId,
        { conversationId: conversation.publicId },
      )
    }
  }
}
