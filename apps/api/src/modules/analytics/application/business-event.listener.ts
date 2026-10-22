import { Injectable } from "@nestjs/common"
import {
  budgetBucket,
  EXPLICIT_FEEDBACK,
  type ConversionKind,
  type ExplicitFeedback,
} from "@mon-appart/analytics"
import { LISTING_TYPES } from "@mon-appart/types"

import type { DomainEvent } from "../../../common/events/domain-event"
import { OnEvents } from "../../../common/events/on-events.decorator"
import { BillingEvent } from "../../billing"
import { CommunicationEvent } from "../../communication"
import { IdentityEvent } from "../../identity"
import { ListingEvent } from "../../listing"
import {
  InteractionEvent,
  type FavoriteChangedPayload,
} from "../../interaction"
import {
  RecommendationEvent,
  type RecommendationFeedbackPayload,
  type RecommendationServedPayload,
} from "../../recommendation"
import {
  SEARCH_PERFORMED_EVENT,
  type SearchPerformedPayload,
} from "../../search"
import { TrustEvent } from "../../trust"
import { AnalyticsConfig } from "../analytics.config"
import { deterministicEventId } from "../domain/ingestion-rules"
import { BusinessFactsRepository } from "../infrastructure/business-facts.repository"
import { AnalyticsTracker } from "./analytics-tracker"

const ASYNC = { async: true, promisify: true, suppressErrors: true } as const

const STATUS_EVENTS = {
  [ListingEvent.PUBLISHED]: "listing_published",
  [ListingEvent.PAUSED]: "listing_paused",
  [ListingEvent.EXPIRED]: "listing_expired",
  [ListingEvent.RENTED]: "listing_marked_as_rented",
  [ListingEvent.SOLD]: "listing_marked_as_sold",
} as const

const FIELD = /^[a-zA-Z]{1,40}$/
const CODE = /^[A-Z0-9_]{1,40}$/
const LISTING_TYPE_SET = new Set<string>(LISTING_TYPES)
const EXPLICIT = new Set<string>(EXPLICIT_FEEDBACK)

async function knownCode(
  code: string | null,
  exists: (code: string) => Promise<boolean>,
): Promise<string | null> {
  if (!code || !CODE.test(code)) return null
  return (await exists(code)) ? code : null
}

/**
 * Traduit les événements de domaine (publiés après commit) en événements
 * analytiques. Chaque fait est relu en base : seul un résultat réel est
 * enregistré. Les identifiants sont déterministes, un rejeu ne duplique rien.
 * Aucune erreur ne remonte vers l'action d'origine.
 */
@Injectable()
export class BusinessEventListener {
  constructor(
    private readonly tracker: AnalyticsTracker,
    private readonly facts: BusinessFactsRepository,
    private readonly config: AnalyticsConfig,
  ) {}

  // ---------------------------------------------------------------- annonces

  @OnEvents([ListingEvent.CREATED], ASYNC)
  async onListingCreated(
    event: DomainEvent<{ listingId: string; listingType: string }>,
  ): Promise<void> {
    const listing = await this.facts.listing(event.payload.listingId)
    if (!listing) return
    await this.tracker.track(
      "listing_creation_completed",
      { listingId: event.payload.listingId, listingType: listing.listingType },
      {
        eventId: deterministicEventId(
          "listing_creation_completed",
          event.payload.listingId,
        ),
        userId: listing.createdById,
        listingId: listing.id,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  @OnEvents([ListingEvent.UPDATED], ASYNC)
  async onListingUpdated(
    event: DomainEvent<{ listingId: string; changedFields: string[] }>,
  ): Promise<void> {
    const changedFields = event.payload.changedFields
      .filter((field) => FIELD.test(field))
      .slice(0, 30)
    await this.tracker.track(
      "listing_updated",
      { listingId: event.payload.listingId, changedFields },
      {
        eventId: deterministicEventId("listing_updated", event.id),
        userId: null,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  @OnEvents(Object.keys(STATUS_EVENTS), ASYNC)
  async onListingStatus(
    event: DomainEvent<{ listingId: string }>,
  ): Promise<void> {
    const name = STATUS_EVENTS[event.name as keyof typeof STATUS_EVENTS]
    if (!name) return
    await this.tracker.track(
      name,
      { listingId: event.payload.listingId },
      {
        eventId: deterministicEventId(name, event.id),
        userId: null,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  // ------------------------------------------------------------------ compte

  @OnEvents(
    [
      IdentityEvent.UserRegistered,
      IdentityEvent.EmailVerified,
      IdentityEvent.PhoneVerified,
    ],
    ASYNC,
  )
  async onIdentity(event: DomainEvent<object>): Promise<void> {
    const userId = await this.facts.userId(event.aggregateId)
    if (userId === null) return
    const name =
      event.name === IdentityEvent.UserRegistered
        ? "registration_completed"
        : event.name === IdentityEvent.EmailVerified
          ? "email_verification_completed"
          : "phone_verification_completed"
    await this.tracker.track(
      name,
      {},
      {
        eventId:
          name === "registration_completed"
            ? deterministicEventId(name, event.aggregateId)
            : deterministicEventId(name, event.id),
        userId,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  // --------------------------------------------------------------- recherche

  @OnEvents([SEARCH_PERFORMED_EVENT], ASYNC)
  async onSearch(event: DomainEvent<SearchPerformedPayload>): Promise<void> {
    const payload = event.payload
    // Codes validés contre le référentiel : une saisie libre n'est jamais conservée.
    const [propertyType, commune] = await Promise.all([
      knownCode(payload.propertyType, (code) =>
        this.facts.propertyTypeExists(code),
      ),
      knownCode(payload.commune, (code) => this.facts.communeExists(code)),
    ])
    await this.tracker.track(
      "search_submitted",
      {
        resultCount: Math.min(Math.max(payload.resultCount, 0), 100_000),
        sort: payload.sort,
        filters: payload.filters,
        listingType:
          payload.listingType && LISTING_TYPE_SET.has(payload.listingType)
            ? (payload.listingType as (typeof LISTING_TYPES)[number])
            : null,
        propertyType,
        commune,
        budgetBucket: budgetBucket(payload.priceMax),
      },
      {
        eventId: deterministicEventId("search_submitted", event.id),
        userId: await this.facts.userId(payload.userId),
        occurredAt: new Date(event.occurredAt),
        requestId: payload.requestId,
      },
    )
  }

  // -------------------------------------------------------------- favoris

  @OnEvents([InteractionEvent.FAVORITE_ADDED], ASYNC)
  async onFavoriteAdded(
    event: DomainEvent<FavoriteChangedPayload>,
  ): Promise<void> {
    const { userId, listingId } = event.payload
    await this.tracker.track(
      "listing_favorited",
      { listingId },
      {
        eventId: deterministicEventId(
          "listing_favorited",
          userId,
          listingId,
          event.occurredAt,
        ),
        userId: await this.facts.userId(userId),
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  @OnEvents([InteractionEvent.FAVORITE_REMOVED], ASYNC)
  async onFavoriteRemoved(
    event: DomainEvent<FavoriteChangedPayload>,
  ): Promise<void> {
    const { userId, listingId } = event.payload
    await this.tracker.track(
      "listing_unfavorited",
      { listingId },
      {
        eventId: deterministicEventId(
          "listing_unfavorited",
          userId,
          listingId,
          event.occurredAt,
        ),
        userId: await this.facts.userId(userId),
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  // ---------------------------------------------------------- recommandation

  @OnEvents([RecommendationEvent.SERVED], ASYNC)
  async onRecommendationServed(
    event: DomainEvent<RecommendationServedPayload>,
  ): Promise<void> {
    const payload = event.payload
    await this.tracker.track(
      "recommendations_requested",
      {
        recommendationRequestId: payload.requestId,
        algorithmVersion: payload.algorithmVersion,
        context: payload.context,
        itemCount: payload.itemCount,
      },
      {
        eventId: deterministicEventId(
          "recommendations_requested",
          payload.requestId,
        ),
        userId: await this.facts.userId(payload.userId),
        occurredAt: new Date(event.occurredAt),
        requestId: payload.httpRequestId,
      },
    )
  }

  @OnEvents([RecommendationEvent.FEEDBACK], ASYNC)
  async onRecommendationFeedback(
    event: DomainEvent<RecommendationFeedbackPayload>,
  ): Promise<void> {
    const { recommendationId, type } = event.payload
    // Affichage et clic sont mesurés par les événements d'exposition client.
    if (type !== "NOT_INTERESTED" && !EXPLICIT.has(type)) return
    const row = await this.facts.recommendation(recommendationId)
    if (!row) return
    const common = {
      listingId: row.listing.publicId,
      algorithmVersion: row.algorithmVersion,
      position: row.rank && row.rank <= 500 ? row.rank : null,
    }
    const context = {
      eventId: deterministicEventId(
        "recommendation_feedback",
        recommendationId,
        type,
      ),
      userId: row.userId,
      listingId: row.listingId,
      occurredAt: new Date(event.occurredAt),
    }
    if (type === "NOT_INTERESTED") {
      await this.tracker.track("recommendation_dismissed", common, context)
      return
    }
    await this.tracker.track(
      "recommendation_feedback_submitted",
      { ...common, feedback: type as ExplicitFeedback },
      context,
    )
  }

  // ---------------------------------------------------- messagerie et visites

  @OnEvents([CommunicationEvent.CONVERSATION_CREATED], ASYNC)
  async onConversationCreated(
    event: DomainEvent<{ conversationId: string; listingId: string }>,
  ): Promise<void> {
    const conversation = await this.facts.conversation(
      event.payload.conversationId,
    )
    if (!conversation) return
    const properties = {
      listingId: conversation.listing.publicId,
      conversationId: conversation.publicId,
    }
    const context = {
      userId: conversation.requesterId,
      listingId: conversation.listingId,
      occurredAt: conversation.createdAt,
    }
    await this.tracker.track("conversation_created", properties, {
      ...context,
      eventId: deterministicEventId(
        "conversation_created",
        conversation.publicId,
      ),
    })
    if (conversation.type !== "PROPERTY_INQUIRY") return
    await this.tracker.track("listing_contact_submitted", properties, {
      ...context,
      eventId: deterministicEventId(
        "listing_contact_submitted",
        conversation.publicId,
      ),
    })
    await this.attribute(
      "CONTACT",
      conversation.publicId,
      conversation.requesterId,
      conversation.listingId,
      conversation.listing.publicId,
      conversation.createdAt,
    )
  }

  @OnEvents([CommunicationEvent.MESSAGE_SENT], ASYNC)
  async onMessageSent(
    event: DomainEvent<{ conversationId: string; messageId: string }>,
  ): Promise<void> {
    const [conversation, message] = await Promise.all([
      this.facts.conversation(event.payload.conversationId),
      this.facts.message(event.payload.messageId),
    ])
    // Messages système : pas d'auteur, pas d'événement.
    if (!conversation || !message || message.authorId === null) return
    if (message.conversationId !== conversation.id) return
    const fromRequester = message.authorId === conversation.requesterId
    const base = {
      listingId: conversation.listing.publicId,
      conversationId: conversation.publicId,
    }
    await this.tracker.track(
      "message_sent",
      {
        ...base,
        side: fromRequester ? "REQUESTER" : "LISTING",
        withAttachments: message._count.attachments > 0,
      },
      {
        eventId: deterministicEventId("message_sent", event.payload.messageId),
        userId: message.authorId,
        listingId: conversation.listingId,
        occurredAt: message.createdAt,
      },
    )
    if (fromRequester || conversation.requesterId === null) return

    const earlier = await this.facts.listingSideMessagesBefore(
      conversation.id,
      conversation.requesterId,
      message.seq,
    )
    if (earlier > 0) return
    const first = await this.facts.firstRequesterMessage(
      conversation.id,
      conversation.requesterId,
    )
    const reference = first?.createdAt ?? conversation.createdAt
    await this.tracker.track(
      "message_reply_received",
      {
        ...base,
        responseSeconds: Math.min(
          Math.max(
            Math.round(
              (message.createdAt.getTime() - reference.getTime()) / 1_000,
            ),
            0,
          ),
          31_536_000,
        ),
      },
      {
        eventId: deterministicEventId(
          "message_reply_received",
          conversation.publicId,
        ),
        userId: conversation.requesterId,
        listingId: conversation.listingId,
        occurredAt: message.createdAt,
      },
    )
    if (this.config.leadRule !== "APPOINTMENT") {
      await this.qualifiedLead(
        conversation.publicId,
        conversation.listing.publicId,
        conversation.listingId,
        conversation.requesterId,
        message.createdAt,
      )
    }
  }

  @OnEvents([CommunicationEvent.APPOINTMENT_CHANGED], ASYNC)
  async onAppointmentChanged(
    event: DomainEvent<{ appointmentId: string; status: string }>,
  ): Promise<void> {
    const { appointmentId, status } = event.payload
    const name = {
      PENDING: "appointment_requested",
      CONFIRMED: "appointment_confirmed",
      CANCELLED: "appointment_cancelled",
      COMPLETED: "appointment_completed",
    }[status] as
      | "appointment_requested"
      | "appointment_confirmed"
      | "appointment_cancelled"
      | "appointment_completed"
      | undefined
    if (!name) return
    const appointment = await this.facts.appointment(appointmentId)
    if (!appointment) return
    const occurredAt = new Date(event.occurredAt)
    // Une visite peut être reconfirmée après un report : une ligne par confirmation.
    const discriminator =
      name === "appointment_confirmed"
        ? (appointment.confirmedAt?.toISOString() ?? event.id)
        : ""
    await this.tracker.track(
      name,
      { listingId: appointment.listing.publicId, appointmentId },
      {
        eventId: deterministicEventId(name, appointmentId, discriminator),
        userId: appointment.userId,
        listingId: appointment.listingId,
        occurredAt,
      },
    )
    if (name !== "appointment_requested") return
    await this.attribute(
      "APPOINTMENT",
      appointmentId,
      appointment.userId,
      appointment.listingId,
      appointment.listing.publicId,
      occurredAt,
    )
    if (this.config.leadRule !== "REPLY" && appointment.conversation) {
      await this.qualifiedLead(
        appointment.conversation.publicId,
        appointment.listing.publicId,
        appointment.listingId,
        appointment.userId,
        occurredAt,
      )
    }
  }

  // ------------------------------------------------------------ signalements

  @OnEvents([TrustEvent.REPORT_CREATED], ASYNC)
  async onReport(
    event: DomainEvent<{
      reportId: string
      targetType: string
      targetId: string
      reason: string
    }>,
  ): Promise<void> {
    const { reportId, targetType, targetId, reason } = event.payload
    if (targetType !== "LISTING" || !CODE.test(reason)) return
    const report = await this.facts.report(reportId)
    if (!report) return
    await this.tracker.track(
      "listing_report_submitted",
      { listingId: targetId, reason },
      {
        eventId: deterministicEventId("listing_report_submitted", reportId),
        userId: report.reporterId,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  // ------------------------------------------------------------ monétisation

  @OnEvents([BillingEvent.CHECKOUT_STARTED], ASYNC)
  async onCheckoutStarted(
    event: DomainEvent<{ orderId: string }>,
  ): Promise<void> {
    const order = await this.facts.billingOrder(event.payload.orderId)
    if (!order || !CODE.test(order.productCode)) return
    await this.tracker.track(
      "checkout_started",
      {
        orderId: order.publicId,
        orderKind: order.kind,
        productCode: order.productCode,
      },
      {
        eventId: deterministicEventId("checkout_started", order.publicId),
        userId: order.buyerId,
        occurredAt: order.createdAt,
      },
    )
  }

  @OnEvents(
    [
      BillingEvent.PAYMENT_ATTEMPT_CREATED,
      BillingEvent.PAYMENT_SUCCEEDED,
      BillingEvent.PAYMENT_FAILED,
    ],
    ASYNC,
  )
  async onPayment(event: DomainEvent<{ paymentId: string }>): Promise<void> {
    const payment = await this.facts.payment(event.payload.paymentId)
    if (!payment) return
    const properties = {
      orderId: payment.order.publicId,
      paymentId: payment.publicId,
      provider: payment.provider,
    }
    const context = { userId: payment.order.buyerId }
    if (event.name === BillingEvent.PAYMENT_ATTEMPT_CREATED) {
      await this.tracker.track("payment_attempt_created", properties, {
        ...context,
        eventId: deterministicEventId(
          "payment_attempt_created",
          payment.publicId,
        ),
        occurredAt: payment.createdAt,
      })
      return
    }
    // Seul l'état relu en base fait foi, jamais la charge de l'événement.
    if (event.name === BillingEvent.PAYMENT_SUCCEEDED) {
      if (payment.status !== "SUCCEEDED" || !payment.succeededAt) return
      await this.tracker.track("payment_succeeded", properties, {
        ...context,
        eventId: deterministicEventId("payment_succeeded", payment.publicId),
        occurredAt: payment.succeededAt,
      })
      return
    }
    if (
      payment.status !== "FAILED" &&
      payment.status !== "CANCELLED" &&
      payment.status !== "EXPIRED"
    ) {
      return
    }
    await this.tracker.track(
      "payment_failed",
      { ...properties, status: payment.status },
      {
        ...context,
        eventId: deterministicEventId("payment_failed", payment.publicId),
        occurredAt: payment.failedAt ?? new Date(event.occurredAt),
      },
    )
  }

  @OnEvents(
    [BillingEvent.SUBSCRIPTION_STARTED, BillingEvent.SUBSCRIPTION_RENEWED],
    ASYNC,
  )
  async onSubscriptionGranted(
    event: DomainEvent<{ subscriptionId: string; orderId?: string }>,
  ): Promise<void> {
    const { subscriptionId, orderId } = event.payload
    if (!orderId) return
    const [subscription, period] = await Promise.all([
      this.facts.subscription(subscriptionId),
      this.facts.subscriptionPeriodOf(orderId),
    ])
    if (!subscription || period?.subscription.publicId !== subscriptionId) {
      return
    }
    if (!CODE.test(subscription.product.code)) return
    const name =
      event.name === BillingEvent.SUBSCRIPTION_STARTED
        ? "subscription_started"
        : "subscription_renewed"
    await this.tracker.track(
      name,
      { subscriptionId, productCode: subscription.product.code },
      {
        eventId: deterministicEventId(name, orderId),
        userId: subscription.userId,
        occurredAt: period.createdAt,
      },
    )
  }

  @OnEvents([BillingEvent.SUBSCRIPTION_CANCELLED], ASYNC)
  async onSubscriptionCancelled(
    event: DomainEvent<{ subscriptionId: string; reason: string }>,
  ): Promise<void> {
    const { subscriptionId, reason } = event.payload
    if (reason !== "USER_REQUEST" && reason !== "FULL_REFUND") return
    const subscription = await this.facts.subscription(subscriptionId)
    if (!subscription || !CODE.test(subscription.product.code)) return
    const confirmed =
      reason === "USER_REQUEST"
        ? subscription.cancelAtPeriodEnd || subscription.status === "CANCELLED"
        : subscription.status === "CANCELLED"
    if (!confirmed) return
    await this.tracker.track(
      "subscription_cancelled",
      { subscriptionId, productCode: subscription.product.code, reason },
      {
        eventId: deterministicEventId(
          "subscription_cancelled",
          subscriptionId,
          reason,
        ),
        userId: subscription.userId,
        occurredAt: new Date(event.occurredAt),
      },
    )
  }

  @OnEvents(
    [BillingEvent.REFUND_REQUESTED, BillingEvent.REFUND_COMPLETED],
    ASYNC,
  )
  async onRefund(event: DomainEvent<{ refundId: string }>): Promise<void> {
    const refund = await this.facts.refund(event.payload.refundId)
    if (!refund) return
    const base = {
      refundId: refund.publicId,
      paymentId: refund.payment.publicId,
    }
    const userId = refund.payment.order.buyerId
    if (event.name === BillingEvent.REFUND_REQUESTED) {
      await this.tracker.track(
        "refund_requested",
        { ...base, byCustomer: refund.requestedByCustomer },
        {
          eventId: deterministicEventId("refund_requested", refund.publicId),
          userId,
          occurredAt: refund.createdAt,
        },
      )
      return
    }
    if (refund.status !== "SUCCEEDED" || !refund.completedAt) return
    await this.tracker.track("refund_completed", base, {
      eventId: deterministicEventId("refund_completed", refund.publicId),
      userId,
      occurredAt: refund.completedAt,
    })
  }

  // ---------------------------------------------------------------- dérivés

  /** Un lead par conversation, quelle que soit la règle qui le déclenche. */
  private async qualifiedLead(
    conversationId: string,
    listingPublicId: string,
    listingId: bigint,
    userId: bigint,
    occurredAt: Date,
  ): Promise<void> {
    await this.tracker.track(
      "qualified_lead_recorded",
      {
        listingId: listingPublicId,
        conversationId,
        rule: this.config.leadRule,
      },
      {
        eventId: deterministicEventId(
          "qualified_lead_recorded",
          conversationId,
        ),
        userId,
        listingId,
        occurredAt,
      },
    )
  }

  /** Conversion attribuée à la dernière ouverture depuis une recommandation. */
  private async attribute(
    conversion: ConversionKind,
    entityId: string,
    userId: bigint | null,
    listingId: bigint,
    listingPublicId: string,
    at: Date,
  ): Promise<void> {
    if (userId === null) return
    const open = await this.facts.lastRecommendationOpen(
      userId,
      listingId,
      new Date(at.getTime() - this.config.attributionMs),
    )
    if (!open) return
    await this.tracker.track(
      "recommendation_converted",
      { ...open, listingId: listingPublicId, conversion },
      {
        eventId: deterministicEventId(
          "recommendation_converted",
          conversion,
          entityId,
        ),
        userId,
        listingId,
        occurredAt: at,
      },
    )
  }
}
