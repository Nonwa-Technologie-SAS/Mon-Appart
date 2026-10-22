import { Injectable } from "@nestjs/common"

import type { Tx } from "../../../database/database.service"
import { NotificationService } from "../../communication"
import { billingNotice } from "../domain/billing-notices"
import { BillingAuditAction, BillingEntity } from "../domain/billing-events"
import {
  CURRENT_SUBSCRIPTION_STATUSES,
  endAfterRevocation,
  nextPeriod,
} from "../domain/subscription-rules"
import { BillingRepository } from "../infrastructure/billing.repository"
import { BillingActivity } from "./billing-activity"

export interface FulfillableOrder {
  id: bigint
  publicId: string
  buyerId: bigint
  kind: "SUBSCRIPTION_START" | "SUBSCRIPTION_RENEWAL"
  productId: number
  productName: string
  subscriptionId: bigint | null
  intervalMonths: number
  maxActiveListings: number | null
}

export type FulfillmentResult =
  | { outcome: "ALREADY" }
  | { outcome: "CONFLICT" }
  | {
      outcome: "STARTED" | "RENEWED"
      subscriptionPublicId: string
      periodEnd: Date
    }

/**
 * Attribution des droits d'une commande payée, dans la transaction qui
 * confirme le paiement. Idempotente : une commande n'ouvre qu'une période
 * (`subscription_periods.order_id` unique), donc une notification rejouée ou
 * une réconciliation concurrente ne prolonge jamais deux fois.
 */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly notifications: NotificationService,
    private readonly activity: BillingActivity,
  ) {}

  async fulfil(
    tx: Tx,
    order: FulfillableOrder,
    paymentId: bigint | null,
    now: Date,
  ): Promise<FulfillmentResult> {
    await this.repo.lockAccount(tx, order.buyerId)
    const existing = await tx.subscriptionPeriod.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    })
    if (existing) return { outcome: "ALREADY" }

    const current = await tx.subscription.findFirst({
      where: {
        userId: order.buyerId,
        status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
      },
      select: {
        id: true,
        publicId: true,
        productId: true,
        currentPeriodEnd: true,
      },
    })

    if (current && current.productId !== order.productId) {
      const opened = await this.repo.openIncident(
        tx,
        "GRANT_CONFLICT",
        { paymentId, orderId: order.id },
        { reason: "OTHER_PLAN_ACTIVE", order: order.publicId },
      )
      if (opened)
        this.activity.metrics.billing.incidents.inc({ kind: "GRANT_CONFLICT" })
      return { outcome: "CONFLICT" }
    }

    const period = nextPeriod(
      current?.currentPeriodEnd ?? null,
      order.intervalMonths,
      now,
    )
    const rights = {
      status: "ACTIVE" as const,
      maxActiveListings: order.maxActiveListings,
      intervalMonths: order.intervalMonths,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      endedAt: null,
      reminderSentFor: null,
    }

    let subscription: { id: bigint; publicId: string }
    let outcome: "STARTED" | "RENEWED"
    if (current) {
      subscription = await tx.subscription.update({
        where: { id: current.id },
        data: {
          ...rights,
          ...(current.currentPeriodEnd <= now
            ? { currentPeriodStart: period.start }
            : {}),
        },
        select: { id: true, publicId: true },
      })
      outcome = "RENEWED"
    } else if (order.subscriptionId !== null) {
      // Renouvellement payé après la fin de l'abonnement : il reprend.
      subscription = await tx.subscription.update({
        where: { id: order.subscriptionId },
        data: { ...rights, currentPeriodStart: period.start },
        select: { id: true, publicId: true },
      })
      outcome = "RENEWED"
    } else {
      subscription = await tx.subscription.create({
        data: {
          ...rights,
          userId: order.buyerId,
          productId: order.productId,
          currentPeriodStart: period.start,
        },
        select: { id: true, publicId: true },
      })
      outcome = "STARTED"
    }

    await tx.subscriptionPeriod.create({
      data: {
        subscriptionId: subscription.id,
        orderId: order.id,
        periodStart: period.start,
        periodEnd: period.end,
      },
    })
    await tx.billingOrder.update({
      where: { id: order.id },
      data: { fulfilledAt: now },
    })
    await this.activity.audit(
      {
        action: BillingAuditAction.ORDER_FULFILLED,
        actorId: null,
        entityType: BillingEntity.SUBSCRIPTION,
        entityId: subscription.publicId,
        newValues: {
          order: order.publicId,
          outcome,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          maxActiveListings: order.maxActiveListings,
        },
      },
      null,
      tx,
    )
    await this.notifications.notify(
      order.buyerId,
      {
        type: "SYSTEM",
        category: "ACCOUNT",
        ...billingNotice.subscriptionActive(order.productName, period.end),
        data: {
          subscriptionId: subscription.publicId,
          orderId: order.publicId,
        },
        dedupKey: `billing:fulfilled:${order.publicId}`,
      },
      tx,
    )
    return {
      outcome,
      subscriptionPublicId: subscription.publicId,
      periodEnd: period.end,
    }
  }

  /**
   * Remboursement intégral : la période payée par la commande est révoquée et
   * retranchée de l'abonnement. S'il ne reste aucun droit, il se termine.
   */
  async revokeOrderPeriod(
    tx: Tx,
    orderId: bigint,
    now: Date,
  ): Promise<{ subscriptionPublicId: string; ended: boolean } | null> {
    const period = await tx.subscriptionPeriod.findUnique({
      where: { orderId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        revokedAt: true,
        subscription: {
          select: {
            id: true,
            publicId: true,
            userId: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    })
    if (!period || period.revokedAt) return null
    const subscription = period.subscription
    await this.repo.lockAccount(tx, subscription.userId)
    await tx.subscriptionPeriod.update({
      where: { id: period.id },
      data: { revokedAt: now },
    })
    if (!CURRENT_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      return { subscriptionPublicId: subscription.publicId, ended: false }
    }
    const end = endAfterRevocation(subscription, period, now)
    await tx.subscription.update({
      where: { id: subscription.id },
      data:
        end === null
          ? { status: "CANCELLED", cancelledAt: now, endedAt: now }
          : { currentPeriodEnd: end, reminderSentFor: null },
    })
    await this.activity.audit(
      {
        action: BillingAuditAction.SUBSCRIPTION_PERIOD_REVOKED,
        actorId: null,
        entityType: BillingEntity.SUBSCRIPTION,
        entityId: subscription.publicId,
        oldValues: {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
        newValues:
          end === null
            ? { status: "CANCELLED", reason: "FULL_REFUND" }
            : { currentPeriodEnd: end.toISOString(), reason: "FULL_REFUND" },
      },
      null,
      tx,
    )
    return { subscriptionPublicId: subscription.publicId, ended: end === null }
  }
}
