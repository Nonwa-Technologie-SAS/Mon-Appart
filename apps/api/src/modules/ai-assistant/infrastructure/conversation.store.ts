import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import type { AssistantCriteria } from "../domain/assistant-criteria"
import { AiAssistantConfig } from "../ai-assistant.config"

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  at: string
}

export interface AssistantConversation {
  id: string
  ownerUserId: string | null
  sessionKey: string
  criteria: AssistantCriteria | null
  listingIds: string[]
  compareIds: string[]
  messages: ConversationMessage[]
  updatedAt: number
  createdAt: number
}

/**
 * Stockage en mémoire process-local (TTL). Suffisant pour la V1 ;
 * Redis/Postgres pourront remplacer sans changer le service.
 */
@Injectable()
export class ConversationStore {
  private readonly map = new Map<string, AssistantConversation>()

  constructor(private readonly config: AiAssistantConfig) {}

  create(ownerUserId: string | null, sessionKey: string): AssistantConversation {
    this.purgeExpired()
    const now = Date.now()
    const conv: AssistantConversation = {
      id: randomUUID(),
      ownerUserId,
      sessionKey,
      criteria: null,
      listingIds: [],
      compareIds: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    this.map.set(conv.id, conv)
    return conv
  }

  get(
    id: string,
    ownerUserId: string | null,
    sessionKey: string,
  ): AssistantConversation | null {
    this.purgeExpired()
    const conv = this.map.get(id)
    if (!conv) return null
    if (!this.canAccess(conv, ownerUserId, sessionKey)) return null
    return conv
  }

  listForOwner(
    ownerUserId: string | null,
    sessionKey: string,
  ): AssistantConversation[] {
    this.purgeExpired()
    return [...this.map.values()]
      .filter((c) => this.canAccess(c, ownerUserId, sessionKey))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }

  save(conv: AssistantConversation): void {
    conv.updatedAt = Date.now()
    this.map.set(conv.id, conv)
  }

  delete(
    id: string,
    ownerUserId: string | null,
    sessionKey: string,
  ): boolean {
    const conv = this.get(id, ownerUserId, sessionKey)
    if (!conv) return false
    this.map.delete(id)
    return true
  }

  private canAccess(
    conv: AssistantConversation,
    ownerUserId: string | null,
    sessionKey: string,
  ): boolean {
    if (ownerUserId && conv.ownerUserId === ownerUserId) return true
    if (!ownerUserId && conv.ownerUserId == null && conv.sessionKey === sessionKey) {
      return true
    }
    // Utilisateur connecté : accès aussi via session si même session et conversation anonyme
    if (
      ownerUserId &&
      conv.ownerUserId == null &&
      conv.sessionKey === sessionKey
    ) {
      return true
    }
    return false
  }

  private purgeExpired(): void {
    const cutoff = Date.now() - this.config.conversationTtlMs
    for (const [id, conv] of this.map) {
      if (conv.updatedAt < cutoff) this.map.delete(id)
    }
  }
}
