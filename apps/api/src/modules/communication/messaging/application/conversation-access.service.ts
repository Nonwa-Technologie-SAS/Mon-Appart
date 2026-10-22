import { Injectable } from "@nestjs/common"

import type { Db } from "../../../../database/database.service"
import { communicationError } from "../../domain/communication-errors"
import type { ParticipantSide } from "../domain/message-rules"
import {
  ConversationRepository,
  type ConversationRow,
  type ParticipantRow,
} from "../infrastructure/conversation.repository"

export interface ConversationAccessContext {
  conversation: ConversationRow
  side: ParticipantSide
  participant: ParticipantRow
}

/**
 * Seule décision d'accès de la messagerie. Connaître l'identifiant public
 * d'une conversation ne donne aucun droit : il faut en être le client
 * (`requester_id`) ou gérer aujourd'hui le bien (rattachement courant). Un
 * tiers, ou un ancien gestionnaire, reçoit 404 comme si elle n'existait pas.
 */
@Injectable()
export class ConversationAccessService {
  constructor(private readonly conversations: ConversationRepository) {}

  async resolve(
    userId: bigint,
    conversationPublicId: string,
    db: Db = this.conversations.client,
  ): Promise<ConversationAccessContext> {
    const conversation = await this.conversations.findByPublicId(
      conversationPublicId,
      db,
    )
    if (!conversation) throw communicationError("CONVERSATION_NOT_FOUND")
    return this.resolveLoaded(userId, conversation, db)
  }

  async resolveLoaded(
    userId: bigint,
    conversation: ConversationRow,
    db: Db = this.conversations.client,
  ): Promise<ConversationAccessContext> {
    const side = await this.sideOf(userId, conversation, db)
    if (!side) {
      // Un ancien gestionnaire perd l'accès et sort des destinataires.
      await this.conversations.markLeft(conversation.id, [userId], db)
      throw communicationError("CONVERSATION_NOT_FOUND")
    }
    const existing = await this.conversations.findParticipant(
      conversation.id,
      userId,
      db,
    )
    const participant =
      existing && existing.state === "ACTIVE" && existing.role === side
        ? existing
        : await this.conversations.ensureParticipant(
            conversation.id,
            userId,
            side,
            db,
          )
    return { conversation, side, participant }
  }

  private async sideOf(
    userId: bigint,
    conversation: ConversationRow,
    db: Db,
  ): Promise<ParticipantSide | null> {
    if (conversation.requesterId === userId) return "REQUESTER"
    const manager = await this.conversations.isCurrentManager(
      conversation.propertyId,
      userId,
      db,
    )
    return manager ? "LISTING_SIDE" : null
  }
}
