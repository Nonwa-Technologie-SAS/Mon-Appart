import { Injectable, Logger } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { safeErrorMessage } from "../../../common/http/safe-error"
import type { Tx } from "../../../database/database.service"
import type {
  PaymentEventOutcome,
  PaymentStatus,
} from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import type { Actor } from "../../identity"
import { BillingConfig } from "../billing.config"
import { billingError } from "../domain/billing-errors"
import {
  BillingAuditAction,
  BillingEntity,
  BillingEvent,
} from "../domain/billing-events"
import { billingNotice } from "../domain/billing-notices"
import { amountJson, sameMoney } from "../domain/money"
import {
  decidePayment,
  isOrderPayable,
  OPEN_PAYMENT_STATUSES,
  orderOnPaymentSuccess,
  safeFailureCode,
} from "../domain/payment-rules"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import type { ProviderPaymentStatus } from "../infrastructure/providers/payment-provider"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { BillingActivity } from "./billing-activity"
import {
  FulfillmentService,
  type FulfillmentResult,
} from "./fulfillment.service"
import { expireOrderInTx } from "./order-expiry"

export interface PaymentView {
  id: string
  orderId: string
  provider: string
  environment: "TEST" | "LIVE"
  status: PaymentStatus
  amount: string
  currency: string
  /** Page du prestataire ; un retour sur l'application n'est jamais une preuve de paiement. */
  redirectUrl: string | null
  failureCode: string | null
  refundedAmount: string
  expiresAt: string
  succeededAt: string | null
  createdAt: string
}

export const paymentSelect = {
  id: true,
  publicId: true,
  provider: true,
  environment: true,
  status: true,
  amount: true,
  currency: true,
  redirectUrl: true,
  failureCode: true,
  refundedAmount: true,
  expiresAt: true,
  succeededAt: true,
  createdAt: true,
  providerReference: true,
  order: { select: { publicId: true, buyerId: true } },
} as const

type PaymentRow = {
  publicId: string
  provider: string
  environment: "TEST" | "LIVE"
  status: PaymentStatus
  amount: bigint
  currency: string
  redirectUrl: string | null
  failureCode: string | null
  refundedAmount: bigint
  expiresAt: Date
  succeededAt: Date | null
  createdAt: Date
  order: { publicId: string }
}

export type ApplySource = "WEBHOOK" | "RECONCILIATION" | "MANUAL_CHECK"

export interface ApplyResult {
  outcome: Exclude<PaymentEventOutcome, "RECEIVED">
  /** Code d'issue (trace du webhook), sans donnée personnelle. */
  code: string
  paymentId: bigint | null
}

const orderForPayment = {
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
} as const

/**
 * Tentatives de paiement et application des statuts confirmés par le
 * prestataire. Le serveur seul fait évoluer les statuts : le client ne peut
 * ni fixer un montant, ni déclarer un paiement réussi.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger("Billing")

  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly fulfillment: FulfillmentService,
    private readonly notifications: NotificationService,
    private readonly activity: BillingActivity,
    private readonly config: BillingConfig,
  ) {}

  /**
   * Ouvre (ou renvoie) la tentative en cours d'une commande. Un double clic
   * renvoie la même tentative ; l'appel au prestataire a lieu hors
   * transaction, avec la référence marchande comme clé d'idempotence.
   */
  async start(
    actor: Actor,
    orderPublicId: string,
    context: RequestContext,
  ): Promise<PaymentView> {
    const provider = this.providers.active()
    if (!provider) throw billingError("BILLING_UNAVAILABLE")
    const now = new Date()

    const attempt = await this.repo.transaction(async (tx) => {
      const orderId = await this.repo.lockOrderByPublicId(tx, orderPublicId)
      const order = orderId
        ? await tx.billingOrder.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              publicId: true,
              buyerId: true,
              status: true,
              expiresAt: true,
              amount: true,
              currency: true,
              productName: true,
            },
          })
        : null
      if (!order || order.buyerId !== actor.userId) {
        throw billingError("ORDER_NOT_FOUND")
      }
      if (!isOrderPayable(order, now)) {
        if (order.status === "PENDING") {
          await expireOrderInTx(tx, this.activity, order.id, now)
          return { state: "EXPIRED" as const }
        }
        throw billingError("ORDER_NOT_PAYABLE")
      }
      const open = await tx.paymentTransaction.findFirst({
        where: {
          orderId: order.id,
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        select: { id: true, publicId: true, expiresAt: true },
      })
      if (open && open.expiresAt > now) {
        return { state: "EXISTING" as const, existing: open.publicId }
      }
      if (open) {
        await tx.paymentTransaction.update({
          where: { id: open.id },
          data: { status: "EXPIRED", failedAt: now, failureCode: "EXPIRED" },
        })
      }
      const attempts = await tx.paymentTransaction.count({
        where: { orderId: order.id },
      })
      if (attempts >= this.config.maxAttemptsPerOrder) {
        throw billingError("TOO_MANY_ATTEMPTS")
      }
      const payment = await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: provider.code,
          environment: provider.environment,
          amount: order.amount,
          currency: order.currency,
          expiresAt: order.expiresAt,
        },
        select: { publicId: true },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.PAYMENT_STARTED,
          actorId: actor.userId,
          entityType: BillingEntity.PAYMENT,
          entityId: payment.publicId,
          newValues: {
            order: order.publicId,
            provider: provider.code,
            environment: provider.environment,
            amount: amountJson(order.amount),
            currency: order.currency,
          },
        },
        context,
        tx,
      )
      return {
        state: "CREATED" as const,
        created: payment.publicId,
        order: order.publicId,
        amount: order.amount,
        currency: order.currency,
        productName: order.productName,
        expiresAt: order.expiresAt,
      }
    })

    if (attempt.state === "EXPIRED") throw billingError("ORDER_NOT_PAYABLE")
    if (attempt.state === "EXISTING")
      return this.getOwn(actor, attempt.existing)

    try {
      const checkout = await provider.createCheckout({
        reference: attempt.created,
        amount: attempt.amount,
        currency: attempt.currency,
        description: attempt.productName,
        expiresAt: attempt.expiresAt,
      })
      await this.repo.client.paymentTransaction.updateMany({
        where: { publicId: attempt.created, status: "CREATED" },
        data: {
          status: "PENDING",
          providerReference: checkout.providerReference,
          redirectUrl: checkout.redirectUrl,
        },
      })
      this.activity.metrics.billing.paymentAttempts.inc({
        provider: provider.code,
        outcome: "opened",
      })
    } catch (error) {
      await this.repo.client.paymentTransaction.updateMany({
        where: { publicId: attempt.created, status: "CREATED" },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureCode: "PROVIDER_UNAVAILABLE",
        },
      })
      this.activity.metrics.billing.paymentAttempts.inc({
        provider: provider.code,
        outcome: "provider_error",
      })
      this.activity.metrics.billing.providerErrors.inc({
        provider: provider.code,
        operation: "checkout",
      })
      this.logger.warn(
        JSON.stringify({
          action: "billing.checkout_failed",
          payment_id: attempt.created,
          provider: provider.code,
          error: safeErrorMessage(error),
        }),
      )
      throw billingError("PROVIDER_ERROR")
    }

    this.activity.emit(BillingEvent.PAYMENT_ATTEMPT_CREATED, attempt.created, {
      paymentId: attempt.created,
      orderId: attempt.order,
      provider: provider.code,
    })
    this.activity.log("billing.payment_started", context, {
      user_id: actor.publicId,
      order_id: attempt.order,
      payment_id: attempt.created,
      provider: provider.code,
    })
    return this.getOwn(actor, attempt.created)
  }

  async getOwn(actor: Actor, publicId: string): Promise<PaymentView> {
    const row = isUuid(publicId)
      ? await this.repo.client.paymentTransaction.findUnique({
          where: { publicId },
          select: paymentSelect,
        })
      : null
    if (!row || row.order.buyerId !== actor.userId) {
      throw billingError("PAYMENT_NOT_FOUND")
    }
    return toPaymentView(row)
  }

  /**
   * Interroge le prestataire (bouton « vérifier mon paiement », retour de la
   * page de paiement, réconciliation). Seule la réponse authentifiée du
   * prestataire fait évoluer le statut.
   */
  async refreshOwn(actor: Actor, publicId: string): Promise<PaymentView> {
    await this.getOwn(actor, publicId)
    await this.checkWithProvider(publicId, "MANUAL_CHECK")
    return this.getOwn(actor, publicId)
  }

  /** `null` : pas de prestataire, pas de référence, ou référence inconnue. */
  async checkWithProvider(
    publicId: string,
    source: ApplySource,
  ): Promise<ApplyResult | null> {
    const payment = await this.repo.client.paymentTransaction.findUnique({
      where: { publicId },
      select: {
        id: true,
        provider: true,
        providerReference: true,
        status: true,
      },
    })
    if (!payment?.providerReference) return null
    const provider = this.providers.byCode(payment.provider)
    if (!provider) return null
    await this.repo.client.paymentTransaction.update({
      where: { id: payment.id },
      data: { lastCheckedAt: new Date(), checkAttempts: { increment: 1 } },
    })
    let report: ProviderPaymentStatus | null
    try {
      report = await provider.fetchStatus(payment.providerReference)
    } catch (error) {
      this.activity.metrics.billing.providerErrors.inc({
        provider: provider.code,
        operation: "status",
      })
      this.logger.warn(
        JSON.stringify({
          action: "billing.status_check_failed",
          payment_id: publicId,
          provider: provider.code,
          error: safeErrorMessage(error),
        }),
      )
      return null
    }
    if (!report) return null
    return this.applyProviderStatus(provider.code, report, source)
  }

  /**
   * Applique un statut rapporté par le prestataire (notification signée ou
   * interrogation authentifiée). Succès : montant et devise vérifiés contre
   * la tentative, commande payée et droits accordés dans la même transaction.
   */
  async applyProviderStatus(
    providerCode: string,
    report: ProviderPaymentStatus,
    source: ApplySource,
  ): Promise<ApplyResult> {
    const located = await this.repo.client.paymentTransaction.findFirst({
      where: isUuid(report.reference)
        ? {
            provider: providerCode,
            OR: [
              { publicId: report.reference },
              { providerReference: report.providerReference },
            ],
          }
        : {
            provider: providerCode,
            providerReference: report.providerReference,
          },
      select: { id: true, orderId: true },
    })
    if (!located) {
      const opened = await this.repo.openIncident(
        this.repo.client,
        "UNKNOWN_REFERENCE",
        {},
        { provider: providerCode, source, status: report.status },
      )
      if (opened) {
        this.activity.metrics.billing.incidents.inc({
          kind: "UNKNOWN_REFERENCE",
        })
      }
      return { outcome: "REJECTED", code: "UNKNOWN_REFERENCE", paymentId: null }
    }

    const now = new Date()
    const effects = await this.repo.transaction(async (tx) => {
      await this.repo.lockOrder(tx, located.orderId)
      await this.repo.lockPayment(tx, located.id)
      const payment = await tx.paymentTransaction.findUniqueOrThrow({
        where: { id: located.id },
        select: {
          id: true,
          publicId: true,
          status: true,
          amount: true,
          currency: true,
          providerReference: true,
          order: { select: orderForPayment },
        },
      })
      const order = payment.order

      if (
        payment.providerReference &&
        payment.providerReference !== report.providerReference
      ) {
        await this.incident(tx, "UNKNOWN_REFERENCE", payment.id, order.id, {
          reason: "PROVIDER_REFERENCE_MISMATCH",
          source,
        })
        return { result: rejected("PROVIDER_REFERENCE_MISMATCH", payment.id) }
      }

      const decision = decidePayment(payment.status, report.status)
      if (decision.action !== "apply") {
        // Rejeu après un succès : retente l'attribution si elle avait échoué.
        if (
          payment.status === "SUCCEEDED" &&
          order.status === "PAID" &&
          !order.fulfilledAt
        ) {
          const fulfilled = await this.fulfillment.fulfil(
            tx,
            order,
            payment.id,
            now,
          )
          const retry = {
            result: ignored("ALREADY_SUCCEEDED", payment.id),
            fulfilled,
            order,
          }
          await this.enqueuePaymentEvents(tx, retry)
          return retry
        }
        return {
          result: ignored(
            decision.action === "noop" ? "DUPLICATE_STATUS" : decision.reason,
            payment.id,
          ),
        }
      }

      if (
        decision.next === "SUCCEEDED" &&
        !sameMoney(payment, {
          amount: report.amount,
          currency: report.currency,
        })
      ) {
        await this.incident(tx, "AMOUNT_MISMATCH", payment.id, order.id, {
          expectedAmount: amountJson(payment.amount),
          expectedCurrency: payment.currency,
          reportedAmount: amountJson(report.amount),
          reportedCurrency: report.currency,
          source,
        })
        return { result: rejected("AMOUNT_MISMATCH", payment.id) }
      }

      const succeeded = decision.next === "SUCCEEDED"
      const failed = ["FAILED", "CANCELLED", "EXPIRED"].includes(decision.next)
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: decision.next,
          ...(payment.providerReference
            ? {}
            : { providerReference: report.providerReference }),
          ...(succeeded ? { succeededAt: now, failureCode: null } : {}),
          ...(failed
            ? {
                failedAt: now,
                failureCode:
                  safeFailureCode(report.failureCode) ?? decision.next,
              }
            : {}),
        },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.PAYMENT_STATUS_CHANGED,
          actorId: null,
          entityType: BillingEntity.PAYMENT,
          entityId: payment.publicId,
          oldValues: { status: payment.status },
          newValues: {
            status: decision.next,
            source,
            ...(decision.lateSuccess ? { lateSuccess: true } : {}),
          },
        },
        null,
        tx,
      )

      if (!succeeded) {
        if (failed) {
          await this.notifications.notify(
            order.buyerId,
            {
              type: "SYSTEM",
              category: "ACCOUNT",
              ...billingNotice.paymentFailed(order.productName),
              data: { orderId: order.publicId, paymentId: payment.publicId },
              dedupKey: `billing:payment-failed:${payment.publicId}`,
            },
            tx,
          )
        }
        const failedEffect = {
          result: applied(decision.next, payment.id),
          status: decision.next,
          payment,
          order,
        }
        await this.enqueuePaymentEvents(tx, failedEffect)
        return failedEffect
      }

      if (decision.lateSuccess) {
        await this.incident(tx, "LATE_SUCCESS", payment.id, order.id, {
          previousStatus: payment.status,
          orderStatus: order.status,
          source,
        })
      }
      if (orderOnPaymentSuccess(order.status) === "DUPLICATE") {
        await this.incident(tx, "DUPLICATE_PAYMENT", payment.id, order.id, {
          orderStatus: order.status,
          source,
        })
        const duplicate = {
          result: applied("SUCCEEDED_DUPLICATE", payment.id),
          status: "SUCCEEDED" as const,
          payment,
          order,
        }
        await this.enqueuePaymentEvents(tx, duplicate)
        return duplicate
      }
      await tx.billingOrder.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: now },
      })
      await this.notifications.notify(
        order.buyerId,
        {
          type: "SYSTEM",
          category: "ACCOUNT",
          ...billingNotice.paymentSucceeded(order.productName),
          data: { orderId: order.publicId, paymentId: payment.publicId },
          dedupKey: `billing:payment-succeeded:${payment.publicId}`,
        },
        tx,
      )
      const fulfilled = await this.fulfillment.fulfil(
        tx,
        order,
        payment.id,
        now,
      )
      const succeededEffect = {
        result: applied("SUCCEEDED", payment.id),
        status: "SUCCEEDED" as const,
        payment,
        order,
        fulfilled,
      }
      await this.enqueuePaymentEvents(tx, succeededEffect)
      return succeededEffect
    })

    await this.afterApply(providerCode, effects)
    return effects.result
  }

  private async incident(
    tx: Tx,
    kind:
      | "AMOUNT_MISMATCH"
      | "LATE_SUCCESS"
      | "DUPLICATE_PAYMENT"
      | "UNKNOWN_REFERENCE",
    paymentId: bigint,
    orderId: bigint,
    detail: Record<string, string>,
  ): Promise<void> {
    if (
      await this.repo.openIncident(tx, kind, { paymentId, orderId }, detail)
    ) {
      this.activity.metrics.billing.incidents.inc({ kind })
    }
  }

  private async enqueuePaymentEvents(
    tx: Tx,
    effects: {
      status?: PaymentStatus
      payment?: { publicId: string }
      order?: { publicId: string }
      fulfilled?: FulfillmentResult
    },
  ): Promise<void> {
    const { status, payment, order, fulfilled } = effects
    if (status && payment && order) {
      if (status === "SUCCEEDED") {
        await this.activity.enqueue(tx, {
          name: BillingEvent.PAYMENT_SUCCEEDED,
          producer: "billing",
          aggregateType: "payment",
          aggregateId: payment.publicId,
          payload: {
            paymentId: payment.publicId,
            orderId: order.publicId,
          },
        })
      } else if (status !== "PENDING") {
        await this.activity.enqueue(tx, {
          name: BillingEvent.PAYMENT_FAILED,
          producer: "billing",
          aggregateType: "payment",
          aggregateId: payment.publicId,
          payload: {
            paymentId: payment.publicId,
            orderId: order.publicId,
            status,
          },
        })
      }
    }
    if (
      fulfilled &&
      fulfilled.outcome !== "ALREADY" &&
      fulfilled.outcome !== "CONFLICT" &&
      order
    ) {
      const started = fulfilled.outcome === "STARTED"
      await this.activity.enqueue(tx, {
        name: started
          ? BillingEvent.SUBSCRIPTION_STARTED
          : BillingEvent.SUBSCRIPTION_RENEWED,
        producer: "billing",
        aggregateType: "subscription",
        aggregateId: fulfilled.subscriptionPublicId,
        payload: {
          subscriptionId: fulfilled.subscriptionPublicId,
          orderId: order.publicId,
        },
      })
    }
  }

  /** Métriques après validation de la transaction ; l'outbox est déjà écrite. */
  private async afterApply(
    providerCode: string,
    effects: {
      result: ApplyResult
      status?: PaymentStatus
      payment?: { publicId: string }
      order?: { publicId: string; buyerId: bigint }
      fulfilled?: FulfillmentResult
    },
  ): Promise<void> {
    const { status, payment, order, fulfilled } = effects
    if (status && payment && order) {
      this.activity.metrics.billing.paymentResults.inc({
        provider: providerCode,
        status,
      })
      this.activity.log("billing.payment_status", null, {
        payment_id: payment.publicId,
        order_id: order.publicId,
        status,
        outcome: effects.result.code,
      })
    }
    if (
      fulfilled &&
      fulfilled.outcome !== "ALREADY" &&
      fulfilled.outcome !== "CONFLICT" &&
      order
    ) {
      const started = fulfilled.outcome === "STARTED"
      this.activity.metrics.billing.subscriptionChanges.inc({
        change: started ? "started" : "renewed",
      })
    }
    await this.activity.flush()
  }
}

function applied(code: string, paymentId: bigint): ApplyResult {
  return { outcome: "APPLIED", code, paymentId }
}
function ignored(code: string, paymentId: bigint): ApplyResult {
  return { outcome: "IGNORED", code, paymentId }
}
function rejected(code: string, paymentId: bigint): ApplyResult {
  return { outcome: "REJECTED", code, paymentId }
}

export function toPaymentView(row: PaymentRow): PaymentView {
  return {
    id: row.publicId,
    orderId: row.order.publicId,
    provider: row.provider,
    environment: row.environment,
    status: row.status,
    amount: amountJson(row.amount),
    currency: row.currency,
    redirectUrl: row.redirectUrl,
    failureCode: row.failureCode,
    refundedAmount: amountJson(row.refundedAmount),
    expiresAt: row.expiresAt.toISOString(),
    succeededAt: row.succeededAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
