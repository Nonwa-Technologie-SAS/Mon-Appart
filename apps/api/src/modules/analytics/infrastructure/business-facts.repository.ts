import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../database/database.service"

/**
 * Relectures des faits métier à partir des identifiants publics portés par
 * les événements de domaine. Ne sélectionne jamais de contenu (corps de
 * message, notes, coordonnées) : seulement identifiants, statuts, dates.
 */
@Injectable()
export class BusinessFactsRepository {
  constructor(private readonly db: DatabaseService) {}

  private get client() {
    return this.db.client
  }

  async userId(publicId: string | null): Promise<bigint | null> {
    if (!publicId) return null
    const row = await this.client.user.findUnique({
      where: { publicId },
      select: { id: true },
    })
    return row?.id ?? null
  }

  listing(publicId: string) {
    return this.client.listing.findUnique({
      where: { publicId },
      select: { id: true, createdById: true, listingType: true },
    })
  }

  conversation(publicId: string) {
    return this.client.conversation.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        type: true,
        requesterId: true,
        createdAt: true,
        listingId: true,
        listing: { select: { publicId: true } },
      },
    })
  }

  message(publicId: string) {
    return this.client.message.findUnique({
      where: { publicId },
      select: {
        id: true,
        seq: true,
        type: true,
        authorId: true,
        createdAt: true,
        conversationId: true,
        _count: { select: { attachments: true } },
      },
    })
  }

  /** Premier message du demandeur, référence du délai de réponse. */
  firstRequesterMessage(conversationId: bigint, requesterId: bigint) {
    return this.client.message.findFirst({
      where: { conversationId, authorId: requesterId },
      orderBy: { seq: "asc" },
      select: { createdAt: true },
    })
  }

  /** Messages du côté annonce antérieurs à `seq` (hors messages système). */
  listingSideMessagesBefore(
    conversationId: bigint,
    requesterId: bigint,
    seq: number,
  ): Promise<number> {
    return this.client.message.count({
      where: {
        conversationId,
        seq: { lt: seq },
        authorId: { not: null },
        NOT: { authorId: requesterId },
      },
    })
  }

  appointment(publicId: string) {
    return this.client.appointment.findUnique({
      where: { publicId },
      select: {
        id: true,
        userId: true,
        listingId: true,
        confirmedAt: true,
        listing: { select: { publicId: true } },
        conversation: { select: { publicId: true } },
      },
    })
  }

  report(publicId: string) {
    return this.client.report.findUnique({
      where: { publicId },
      select: { reporterId: true },
    })
  }

  recommendation(publicId: string) {
    return this.client.recommendation.findUnique({
      where: { publicId },
      select: {
        userId: true,
        listingId: true,
        rank: true,
        algorithmVersion: true,
        listing: { select: { publicId: true } },
      },
    })
  }

  async communeExists(code: string): Promise<boolean> {
    const row = await this.client.commune.findFirst({
      where: { code },
      select: { id: true },
    })
    return row !== null
  }

  async propertyTypeExists(code: string): Promise<boolean> {
    const row = await this.client.propertyType.findUnique({
      where: { code },
      select: { id: true },
    })
    return row !== null
  }

  /**
   * Dernière ouverture d'une annonce depuis une recommandation par ce compte,
   * dans la fenêtre d'attribution (événement client consenti).
   */
  async lastRecommendationOpen(
    userId: bigint,
    listingId: bigint,
    since: Date,
  ): Promise<{
    recommendationRequestId: string
    algorithmVersion: string
  } | null> {
    const row = await this.client.analyticsEvent.findFirst({
      where: {
        userId,
        listingId,
        name: "recommended_listing_opened",
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: "desc" },
      select: { properties: true },
    })
    const properties = row?.properties as
      | { recommendationRequestId?: unknown; algorithmVersion?: unknown }
      | undefined
    if (
      typeof properties?.recommendationRequestId !== "string" ||
      typeof properties.algorithmVersion !== "string"
    ) {
      return null
    }
    return {
      recommendationRequestId: properties.recommendationRequestId,
      algorithmVersion: properties.algorithmVersion,
    }
  }

  // ---------------------------------------------------------- monétisation

  billingOrder(publicId: string) {
    return this.client.billingOrder.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        buyerId: true,
        kind: true,
        productCode: true,
        createdAt: true,
      },
    })
  }

  payment(publicId: string) {
    return this.client.paymentTransaction.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        provider: true,
        status: true,
        succeededAt: true,
        failedAt: true,
        createdAt: true,
        order: { select: { publicId: true, buyerId: true } },
      },
    })
  }

  subscription(publicId: string) {
    return this.client.subscription.findUnique({
      where: { publicId },
      select: {
        userId: true,
        status: true,
        cancelAtPeriodEnd: true,
        product: { select: { code: true } },
      },
    })
  }

  subscriptionPeriodOf(orderPublicId: string) {
    return this.client.subscriptionPeriod.findFirst({
      where: { order: { publicId: orderPublicId } },
      select: { createdAt: true, subscription: { select: { publicId: true } } },
    })
  }

  refund(publicId: string) {
    return this.client.paymentRefund.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        status: true,
        requestedByCustomer: true,
        createdAt: true,
        completedAt: true,
        payment: {
          select: { publicId: true, order: { select: { buyerId: true } } },
        },
      },
    })
  }
}
