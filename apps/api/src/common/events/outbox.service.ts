import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import type { Db } from "../../database/database.service"
import { assertOutboxDraft, type OutboxDraft } from "./event-schema"
import { OutboxDispatcher } from "./outbox.dispatcher"
import { OutboxRepository } from "./outbox.repository"

@Injectable()
export class OutboxService {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  /** Écrit l'événement dans la transaction métier. Ne publie pas encore. */
  async append(tx: Db, draft: OutboxDraft): Promise<string> {
    assertOutboxDraft(draft)
    const eventId = randomUUID()
    await this.outbox.insert(tx, {
      ...draft,
      eventId,
      occurredAt: draft.occurredAt ?? new Date(),
    })
    return eventId
  }

  /**
   * Publie les événements PENDING (après commit). Les listeners asynchrones
   * ne bloquent pas : EventEmitter.emit est synchrone pour l'enregistrement.
   */
  flush(): Promise<number> {
    return this.dispatcher.runOnce()
  }

  wake(): void {
    this.dispatcher.wake()
  }
}
