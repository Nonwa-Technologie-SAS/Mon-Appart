import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { safeErrorMessage } from "../../../common/http/safe-error"
import { NotificationService } from "../../communication"
import { BillingConfig } from "../billing.config"
import {
  BillingAuditAction,
  BillingEntity,
  BillingEvent,
} from "../domain/billing-events"
import { billingNotice } from "../domain/billing-notices"
import { OPEN_PAYMENT_STATUSES } from "../domain/payment-rules"
import { addDays, dueTransition } from "../domain/subscription-rules"
import { BillingRepository } from "../infrastructure/billing.repository"
import { BillingActivity } from "./billing-activity"
import { FulfillmentService } from "./fulfillment.service"
import { expireOrderInTx } from "./order-expiry"
import { PaymentService } from "./payment.service"
import { RefundService } from "./refund.service"

const BATCH = 100
/** Délai minimal entre deux interrogations d'une même tentative. */
const RECHECK_MS = 2 * 60_000
/** Au-delà, une tentative sans réponse du prestataire est close localement. */
const ABANDON_AFTER_MS = 24 * 3_600_000

export interface ReconciliationReport {
  expiredOrders: number
  checkedPayments: number
  abandonedPayments: number
  fulfilledOrders: number
  subscriptionChanges: number
  reminders: number
  checkedRefunds: number
}

/**
 * Réconciliation et échéances, idempotentes et sûres en multi-instance
 * (chaque ligne est verrouillée et relue avant écriture) : expiration des
 * commandes, interrogation des paiements sans réponse, reprise des droits
 * non attribués, échéances d'abonnement, rappels, remboursements en cours.
 * Aucun prélèvement : un abonnement échu attend un renouvellement manuel.
 */
@Injectable()
export class ReconciliationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("BillingReconciliation")
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null

  constructor(
    private readonly repo: BillingRepository,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
    private readonly fulfillment: FulfillmentService,
    private readonly notifications: NotificationService,
    private readonly activity: BillingActivity,
    private readonly config: BillingConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.workerIntervalMs <= 0) return
    this.timer = setInterval(() => {
      if (this.running) return
      this.running = this.run()
        .then(() =>
          this.activity.metrics.billing.jobRuns.inc({ outcome: "success" }),
        )
        .catch((error: unknown) => {
          this.activity.metrics.billing.jobRuns.inc({ outcome: "failure" })
          this.logger.error(
            JSON.stringify({
              action: "billing.reconciliation_failed",
              error: safeErrorMessage(error),
            }),
          )
        })
        .finally(() => {
          this.running = null
        })
    }, this.config.workerIntervalMs)
    this.timer.unref()
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.running?.catch(() => undefined)
  }

  async run(now = new Date()): Promise<ReconciliationReport> {
    const report: ReconciliationReport = {
      expiredOrders: await this.expireOrders(now),
      ...(await this.checkPayments(now)),
      fulfilledOrders: await this.retryFulfilment(now),
      subscriptionChanges: await this.applyDueDates(now),
      reminders: await this.sendReminders(now),
      checkedRefunds: await this.checkRefunds(),
    }
    if (Object.values(report).some((value) => value > 0)) {
      this.activity.log("billing.reconciliation", null, { ...report })
    }
    return report
  }

  async expireOrders(now: Date): Promise<number> {
    const due = await this.repo.client.billingOrder.findMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    })
    let count = 0
    for (const { id } of due) {
      const expired = await this.repo.transaction(async (tx) => {
        await this.repo.lockOrder(tx, id)
        return expireOrderInTx(tx, this.activity, id, now)
      })
      if (expired) count++
    }
    return count
  }

  async checkPayments(
    now: Date,
  ): Promise<{ checkedPayments: number; abandonedPayments: number }> {
    const open = await this.repo.client.paymentTransaction.findMany({
      where: {
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lte: new Date(now.getTime() - RECHECK_MS) } },
        ],
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { publicId: true, expiresAt: true },
    })
    let checked = 0
    let abandoned = 0
    for (const payment of open) {
      const result = await this.payments.checkWithProvider(
        payment.publicId,
        "RECONCILIATION",
      )
      if (result) checked++
      if (payment.expiresAt.getTime() + ABANDON_AFTER_MS <= now.getTime()) {
        if (await this.abandon(payment.publicId, now)) abandoned++
      }
    }
    return { checkedPayments: checked, abandonedPayments: abandoned }
  }

  /**
   * Vérification à la demande d'un agent (`billing:reconcile`) : interroge le
   * prestataire et applique sa réponse. Ne permet pas de déclarer un paiement.
   */
  async checkPayment(
    paymentPublicId: string,
  ): Promise<{ checked: boolean; outcome: string | null }> {
    const result = await this.payments.checkWithProvider(
      paymentPublicId,
      "MANUAL_CHECK",
    )
    return { checked: result !== null, outcome: result?.code ?? null }
  }

  /** Tentative toujours ouverte longtemps après son échéance : expirée. */
  private async abandon(publicId: string, now: Date): Promise<boolean> {
    return this.repo.transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({
        where: { publicId },
        select: { id: true, orderId: true },
      })
      if (!payment) return false
      await this.repo.lockOrder(tx, payment.orderId)
      await this.repo.lockPayment(tx, payment.id)
      const result = await tx.paymentTransaction.updateMany({
        where: { id: payment.id, status: { in: [...OPEN_PAYMENT_STATUSES] } },
        data: {
          status: "EXPIRED",
          failedAt: now,
          failureCode: "NO_PROVIDER_RESPONSE",
        },
      })
      if (result.count === 0) return false
      await this.activity.audit(
        {
          action: BillingAuditAction.PAYMENT_STATUS_CHANGED,
          actorId: null,
          entityType: BillingEntity.PAYMENT,
          entityId: publicId,
          newValues: { status: "EXPIRED", source: "RECONCILIATION" },
        },
        null,
        tx,
      )
      return true
    })
  }

  /** Commandes payées sans droit attribué (hors conflit en attente d'un agent). */
  async retryFulfilment(now: Date): Promise<number> {
    const orders = await this.repo.client.billingOrder.findMany({
      where: {
        status: "PAID",
        fulfilledAt: null,
        incidents: { none: { kind: "GRANT_CONFLICT", status: "OPEN" } },
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, publicId: true },
    })
    let count = 0
    for (const { id, publicId } of orders) {
      const result = await this.repo.transaction(async (tx) => {
        await this.repo.lockOrder(tx, id)
        const order = await tx.billingOrder.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            publicId: true,
            buyerId: true,
            kind: true,
            status: true,
            productId: true,
            productName: true,
            subscriptionId: true,
            intervalMonths: true,
            maxActiveListings: true,
            fulfilledAt: true,
            payments: {
              where: { status: "SUCCEEDED" },
              take: 1,
              select: { id: true },
            },
          },
        })
        if (order.status !== "PAID" || order.fulfilledAt) return null
        return this.fulfillment.fulfil(
          tx,
          order,
          order.payments[0]?.id ?? null,
          now,
        )
      })
      if (
        result &&
        (result.outcome === "STARTED" || result.outcome === "RENEWED")
      ) {
        count++
        this.activity.emit(
          result.outcome === "STARTED"
            ? BillingEvent.SUBSCRIPTION_STARTED
            : BillingEvent.SUBSCRIPTION_RENEWED,
          result.subscriptionPublicId,
          { subscriptionId: result.subscriptionPublicId, orderId: publicId },
        )
      }
    }
    return count
  }

  async applyDueDates(now: Date): Promise<number> {
    const graceCutoff = addDays(now, -this.config.graceDays)
    const due = await this.repo.client.subscription.findMany({
      where: {
        OR: [
          { status: "ACTIVE", currentPeriodEnd: { lte: now } },
          { status: "PAST_DUE", currentPeriodEnd: { lte: graceCutoff } },
        ],
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, userId: true },
    })
    let count = 0
    for (const { id, userId } of due) {
      const change = await this.repo.transaction(async (tx) => {
        await this.repo.lockAccount(tx, userId)
        const row = await tx.subscription.findUniqueOrThrow({
          where: { id },
          select: {
            publicId: true,
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            product: { select: { name: true } },
          },
        })
        const next = dueTransition(row, now, this.config.graceDays)
        if (!next) return null
        await tx.subscription.update({
          where: { id },
          data: {
            status: next.status,
            ...(next.endedAt ? { endedAt: next.endedAt } : {}),
          },
        })
        await this.activity.audit(
          {
            action: BillingAuditAction.SUBSCRIPTION_STATUS_CHANGED,
            actorId: null,
            entityType: BillingEntity.SUBSCRIPTION,
            entityId: row.publicId,
            oldValues: { status: row.status },
            newValues: { status: next.status },
          },
          null,
          tx,
        )
        const notice =
          next.status === "PAST_DUE"
            ? billingNotice.pastDue(row.product.name)
            : billingNotice.ended(row.product.name)
        await this.notifications.notify(
          userId,
          {
            type: "SYSTEM",
            category: "ACCOUNT",
            ...notice,
            data: { subscriptionId: row.publicId, status: next.status },
            dedupKey: `billing:subscription:${row.publicId}:${next.status}:${row.currentPeriodEnd.toISOString()}`,
          },
          tx,
        )
        return next.status
      })
      if (change) {
        count++
        this.activity.metrics.billing.subscriptionChanges.inc({
          change: change.toLowerCase(),
        })
      }
    }
    return count
  }

  async sendReminders(now: Date): Promise<number> {
    if (this.config.renewalReminderDays <= 0) return 0
    const horizon = addDays(now, this.config.renewalReminderDays)
    const due = await this.repo.client.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: { gt: now, lte: horizon },
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: {
        id: true,
        userId: true,
        publicId: true,
        currentPeriodEnd: true,
        reminderSentFor: true,
        product: { select: { name: true } },
      },
    })
    let count = 0
    for (const row of due) {
      if (row.reminderSentFor?.getTime() === row.currentPeriodEnd.getTime())
        continue
      const sent = await this.repo.transaction(async (tx) => {
        const updated = await tx.subscription.updateMany({
          where: {
            id: row.id,
            status: "ACTIVE",
            currentPeriodEnd: row.currentPeriodEnd,
            OR: [
              { reminderSentFor: null },
              { reminderSentFor: { not: row.currentPeriodEnd } },
            ],
          },
          data: { reminderSentFor: row.currentPeriodEnd },
        })
        if (updated.count === 0) return false
        await this.notifications.notify(
          row.userId,
          {
            type: "SYSTEM",
            category: "ACCOUNT",
            ...billingNotice.renewalReminder(
              row.product.name,
              row.currentPeriodEnd,
            ),
            data: { subscriptionId: row.publicId },
            dedupKey: `billing:renewal-reminder:${row.publicId}:${row.currentPeriodEnd.toISOString()}`,
          },
          tx,
        )
        return true
      })
      if (sent) count++
    }
    return count
  }

  async checkRefunds(): Promise<number> {
    const processing = await this.repo.client.paymentRefund.findMany({
      where: { status: "PROCESSING" },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { publicId: true },
    })
    for (const { publicId } of processing) {
      await this.refunds.execute(publicId)
    }
    return processing.length
  }
}
