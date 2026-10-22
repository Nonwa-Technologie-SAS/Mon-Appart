import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import type {
  BillingIncidentKind,
  BillingIncidentStatus,
  BillingOrderStatus,
  PaymentEventOutcome,
  PaymentStatus,
  RefundStatus,
  SubscriptionStatus,
} from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { BillingConfig } from "../billing.config"
import { billingError } from "../domain/billing-errors"
import { BillingAuditAction, BillingEntity } from "../domain/billing-events"
import { amountJson } from "../domain/money"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { BillingActivity } from "./billing-activity"
import {
  clampLimit,
  orderSelect,
  toOrderView,
  type OrderView,
} from "./order.service"
import { pageOf, type Page } from "./pagination"
import {
  paymentSelect,
  toPaymentView,
  type PaymentView,
} from "./payment.service"
import { refundSelect, toRefundView, type RefundView } from "./refund.service"
import {
  subscriptionSelect,
  toSubscriptionView,
  type SubscriptionView,
} from "./subscription.service"

interface ListQuery<S> {
  status?: S
  cursor?: string
  limit?: number
}

const buyerSelect = {
  select: { publicId: true, firstName: true, lastName: true },
} as const

type BuyerRow = {
  publicId: string
  firstName: string | null
  lastName: string | null
}

export interface BuyerView {
  id: string
  name: string | null
}

export interface AdminOrderView extends OrderView {
  buyer: BuyerView
}

export interface AdminPaymentView extends PaymentView {
  buyer: BuyerView
  checkAttempts: number
  lastCheckedAt: string | null
}

export interface IncidentView {
  id: string
  kind: BillingIncidentKind
  status: BillingIncidentStatus
  paymentId: string | null
  orderId: string | null
  detail: unknown
  resolution: string | null
  resolvedBy: BuyerView | null
  resolvedAt: string | null
  createdAt: string
}

export interface WebhookEventView {
  provider: string
  eventId: string
  paymentId: string | null
  signatureValid: boolean
  outcome: PaymentEventOutcome
  errorCode: string | null
  summary: unknown
  attempts: number
  receivedAt: string
  processedAt: string | null
}

const incidentSelect = {
  publicId: true,
  kind: true,
  status: true,
  detail: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  payment: { select: { publicId: true } },
  order: { select: { publicId: true } },
  resolvedBy: buyerSelect,
} as const

const eventSelect = {
  provider: true,
  eventId: true,
  signatureValid: true,
  outcome: true,
  errorCode: true,
  summary: true,
  attempts: true,
  receivedAt: true,
  processedAt: true,
  payment: { select: { publicId: true } },
} as const

/**
 * Lecture du back-office et diagnostic. Aucune route ne permet de déclarer
 * un paiement réussi ni de modifier un montant : un agent peut relancer la
 * vérification auprès du prestataire, décider d'un remboursement et clore un
 * incident avec une justification. Aucune clé ni secret n'est exposé.
 */
@Injectable()
export class BillingAdminService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly activity: BillingActivity,
    private readonly config: BillingConfig,
  ) {}

  async listOrders(
    query: ListQuery<BillingOrderStatus>,
  ): Promise<Page<AdminOrderView>> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.billingOrder.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursorOf(query.cursor),
      select: { ...orderSelect, buyer: buyerSelect },
    })
    return pageOf(rows, limit, (row) => ({
      ...toOrderView(row),
      buyer: buyerView(row.buyer),
    }))
  }

  async orderDetail(publicId: string) {
    const row = isUuid(publicId)
      ? await this.repo.client.billingOrder.findUnique({
          where: { publicId },
          select: {
            ...orderSelect,
            buyer: buyerSelect,
            payments: {
              orderBy: { createdAt: "desc" },
              take: 50,
              select: {
                ...paymentSelect,
                checkAttempts: true,
                lastCheckedAt: true,
                events: {
                  orderBy: { receivedAt: "desc" },
                  take: 50,
                  select: eventSelect,
                },
                refunds: {
                  orderBy: { createdAt: "desc" },
                  take: 50,
                  select: refundSelect,
                },
              },
            },
            incidents: {
              orderBy: { createdAt: "desc" },
              take: 50,
              select: incidentSelect,
            },
            period: {
              select: {
                periodStart: true,
                periodEnd: true,
                revokedAt: true,
                subscription: { select: { publicId: true, status: true } },
              },
            },
          },
        })
      : null
    if (!row) throw billingError("ORDER_NOT_FOUND")
    return {
      ...toOrderView(row),
      buyer: buyerView(row.buyer),
      payments: row.payments.map((payment) => ({
        ...toPaymentView(payment),
        checkAttempts: payment.checkAttempts,
        lastCheckedAt: payment.lastCheckedAt?.toISOString() ?? null,
        events: payment.events.map(toEventView),
        refunds: payment.refunds.map(toRefundView),
      })),
      incidents: row.incidents.map(toIncidentView),
      period: row.period
        ? {
            periodStart: row.period.periodStart.toISOString(),
            periodEnd: row.period.periodEnd.toISOString(),
            revokedAt: row.period.revokedAt?.toISOString() ?? null,
            subscriptionId: row.period.subscription.publicId,
            subscriptionStatus: row.period.subscription.status,
          }
        : null,
    }
  }

  async listPayments(
    query: ListQuery<PaymentStatus>,
  ): Promise<Page<AdminPaymentView>> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.paymentTransaction.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursorOf(query.cursor),
      select: {
        ...paymentSelect,
        checkAttempts: true,
        lastCheckedAt: true,
        order: {
          select: { publicId: true, buyerId: true, buyer: buyerSelect },
        },
      },
    })
    return pageOf(rows, limit, (row) => ({
      ...toPaymentView(row),
      buyer: buyerView(row.order.buyer),
      checkAttempts: row.checkAttempts,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    }))
  }

  async listSubscriptions(
    query: ListQuery<SubscriptionStatus>,
  ): Promise<Page<SubscriptionView & { user: BuyerView }>> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.subscription.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursorOf(query.cursor),
      select: { ...subscriptionSelect, user: buyerSelect },
    })
    const now = new Date()
    return pageOf(rows, limit, (row) => ({
      ...toSubscriptionView(row, now, this.config),
      user: buyerView(row.user),
    }))
  }

  async listRefunds(query: ListQuery<RefundStatus>): Promise<Page<RefundView>> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.paymentRefund.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursorOf(query.cursor),
      select: refundSelect,
    })
    return pageOf(rows, limit, toRefundView)
  }

  async listIncidents(
    query: ListQuery<BillingIncidentStatus>,
  ): Promise<Page<IncidentView>> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.billingIncident.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...cursorOf(query.cursor),
      select: incidentSelect,
    })
    return pageOf(rows, limit, toIncidentView)
  }

  /** Pagination par date de réception (pas d'identifiant public sur la trace). */
  async listWebhookEvents(query: {
    outcome?: PaymentEventOutcome
    before?: Date
    limit?: number
  }): Promise<{ items: WebhookEventView[]; nextBefore: string | null }> {
    const limit = clampLimit(query.limit)
    const rows = await this.repo.client.paymentEvent.findMany({
      where: {
        ...(query.outcome ? { outcome: query.outcome } : {}),
        ...(query.before ? { receivedAt: { lt: query.before } } : {}),
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: eventSelect,
    })
    const more = rows.length > limit
    const items = (more ? rows.slice(0, limit) : rows).map(toEventView)
    return {
      items,
      nextBefore: more ? items[items.length - 1]!.receivedAt : null,
    }
  }

  async resolveIncident(
    actor: Actor,
    publicId: string,
    resolution: string,
    context: RequestContext,
  ): Promise<IncidentView> {
    if (!isUuid(publicId)) throw billingError("INCIDENT_NOT_FOUND")
    await this.repo.transaction(async (tx) => {
      const found = await tx.billingIncident.findUnique({
        where: { publicId },
        select: { id: true },
      })
      if (!found) throw billingError("INCIDENT_NOT_FOUND")
      await this.repo.lockIncident(tx, found.id)
      const incident = await tx.billingIncident.findUniqueOrThrow({
        where: { id: found.id },
        select: { status: true, kind: true },
      })
      if (incident.status !== "OPEN")
        throw billingError("INCIDENT_ALREADY_RESOLVED")
      await tx.billingIncident.update({
        where: { id: found.id },
        data: {
          status: "RESOLVED",
          resolvedById: actor.userId,
          resolvedAt: new Date(),
          resolution: resolution.trim(),
        },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.INCIDENT_RESOLVED,
          actorId: actor.userId,
          entityType: BillingEntity.INCIDENT,
          entityId: publicId,
          oldValues: { status: "OPEN", kind: incident.kind },
          newValues: { status: "RESOLVED", resolution: resolution.trim() },
        },
        context,
        tx,
      )
    })
    const row = await this.repo.client.billingIncident.findUniqueOrThrow({
      where: { publicId },
      select: incidentSelect,
    })
    return toIncidentView(row)
  }

  /**
   * Synthèse avec définitions explicites. Montants bruts par devise, tels
   * que confirmés par le prestataire : aucun revenu net, aucun frais supposé.
   */
  async summary() {
    const db = this.repo.client
    const [collected, refunded, orders, subscriptions, incidents, refunds] =
      await Promise.all([
        db.paymentTransaction.groupBy({
          by: ["currency", "environment"],
          where: { status: "SUCCEEDED" },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.paymentRefund.groupBy({
          by: ["currency"],
          where: { status: "SUCCEEDED" },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.billingOrder.groupBy({ by: ["status"], _count: { _all: true } }),
        db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
        db.billingIncident.count({ where: { status: "OPEN" } }),
        db.paymentRefund.count({
          where: { status: { in: ["REQUESTED", "PROCESSING"] } },
        }),
      ])
    const provider = this.providers.active()
    return {
      computedAt: new Date().toISOString(),
      provider: provider
        ? {
            code: provider.code,
            environment: provider.environment,
            simulated: this.providers.mock() !== null,
            refunds: provider.capabilities.refunds,
          }
        : null,
      collected: collected.map((row) => ({
        currency: row.currency,
        environment: row.environment,
        amount: amountJson(row._sum.amount ?? 0n),
        payments: row._count._all,
      })),
      refunded: refunded.map((row) => ({
        currency: row.currency,
        amount: amountJson(row._sum.amount ?? 0n),
        refunds: row._count._all,
      })),
      ordersByStatus: Object.fromEntries(
        orders.map((row) => [row.status, row._count._all]),
      ),
      subscriptionsByStatus: Object.fromEntries(
        subscriptions.map((row) => [row.status, row._count._all]),
      ),
      openIncidents: incidents,
      pendingRefunds: refunds,
      definitions: {
        collected:
          "Somme des paiements au statut SUCCEEDED (confirmés par le prestataire), par devise et environnement, depuis l'origine. Montant brut, frais du prestataire non déduits.",
        refunded:
          "Somme des remboursements confirmés par le prestataire (SUCCEEDED), par devise.",
        ordersByStatus: "Nombre de commandes par statut.",
        subscriptionsByStatus: "Nombre d'abonnements par statut.",
        openIncidents: "Incidents de facturation non résolus.",
        pendingRefunds:
          "Demandes de remboursement en attente de décision ou de confirmation.",
      },
    }
  }
}

function cursorOf(cursor: string | undefined): {
  cursor?: { publicId: string }
  skip?: number
} {
  if (!cursor) return {}
  if (!isUuid(cursor)) throw billingError("BILLING_CURSOR_INVALID")
  return { cursor: { publicId: cursor }, skip: 1 }
}

function buyerView(row: BuyerRow): BuyerView {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ")
  return { id: row.publicId, name: name || null }
}

function toIncidentView(row: {
  publicId: string
  kind: BillingIncidentKind
  status: BillingIncidentStatus
  detail: unknown
  resolution: string | null
  resolvedAt: Date | null
  createdAt: Date
  payment: { publicId: string } | null
  order: { publicId: string } | null
  resolvedBy: BuyerRow | null
}): IncidentView {
  return {
    id: row.publicId,
    kind: row.kind,
    status: row.status,
    paymentId: row.payment?.publicId ?? null,
    orderId: row.order?.publicId ?? null,
    detail: row.detail,
    resolution: row.resolution,
    resolvedBy: row.resolvedBy ? buyerView(row.resolvedBy) : null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toEventView(row: {
  provider: string
  eventId: string
  signatureValid: boolean
  outcome: PaymentEventOutcome
  errorCode: string | null
  summary: unknown
  attempts: number
  receivedAt: Date
  processedAt: Date | null
  payment: { publicId: string } | null
}): WebhookEventView {
  return {
    provider: row.provider,
    eventId: row.eventId,
    paymentId: row.payment?.publicId ?? null,
    signatureValid: row.signatureValid,
    outcome: row.outcome,
    errorCode: row.errorCode,
    summary: row.summary,
    attempts: row.attempts,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  }
}
