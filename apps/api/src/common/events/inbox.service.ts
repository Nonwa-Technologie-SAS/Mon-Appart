import { Injectable } from "@nestjs/common"

import {
  DatabaseService,
  isUniqueViolation,
  type Db,
} from "../../database/database.service"

/**
 * Déduplication durable : un couple (consommateur, eventId) n'est enregistré
 * qu'une fois. `claim` retourne false si l'événement a déjà été traité.
 */
@Injectable()
export class InboxService {
  constructor(private readonly db: DatabaseService) {}

  async alreadyProcessed(
    consumerName: string,
    eventId: string,
    db: Db = this.db.client,
  ): Promise<boolean> {
    const row = await db.inboxEvent.findUnique({
      where: {
        consumerName_eventId: { consumerName, eventId },
      },
      select: { id: true },
    })
    return row !== null
  }

  /**
   * Réserve le traitement. false = déjà traité (livraison multiple).
   * L'insertion est unique : deux workers concurrents, un seul gagne.
   */
  async claim(
    consumerName: string,
    eventId: string,
    db: Db = this.db.client,
  ): Promise<boolean> {
    try {
      await db.inboxEvent.create({ data: { consumerName, eventId } })
      return true
    } catch (error) {
      if (isUniqueViolation(error)) return false
      throw error
    }
  }
}
