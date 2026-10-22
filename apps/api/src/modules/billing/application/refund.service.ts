import { Injectable, Logger } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { safeErrorMessage } from "../../../common/http/safe-error"
import { isUniqueViolation, type Tx } from "../../../database/database.service"
import type { RefundStatus } from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import type { Actor } from "../../identity"
import { billingError } from "../domain/billing-errors"
import {
  BillingAuditAction,
  BillingEntity,
  BillingEvent,
} from "../domain/billing-events"
import { billingNotice } from "../domain/billing-notices"
import { amountJson, parseAmount } from "../domain/money"
import { safeFailureCode } from "../domain/payment-rules"
import {
  isFullRefund,
  OPEN_REFUND_STATUSES,
  refundableAmount,
} from "../domain/refund-rules"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import type { ProviderRefundResult } from "../infrastructure/providers/payment-provider"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { BillingActivity } from "./billing-activity"
import { FulfillmentService } from "./fulfillment.service"

export interface RefundView {
  id: string
  paymentId: string
  orderId: string
  amount: string
  currency: string
  status: RefundStatus
  reason: string
  requestedByCustomer: boolean
  decisionNote: string | null
  failureCode: string | null
  decidedAt: string | null
  completedAt: string | null
  createdAt: string
}

export const refundSelect = {
  publicId: true,
  amount: true,
  currency: true,
  status: true,
  reason: true,
  requestedByCustomer: true,
  decisionNote: true,
  failureCode: true,
  decidedAt: true,
  completedAt: true,
  createdAt: true,
  payment: {
    select: {
      publicId: true,
      order: { select: { publicId: true, buyerId: true } },
    },
  },
} as const

type RefundRow = {
  publicId: string
  amount: bigint
  currency: string
  status: RefundStatus
  reason: string
  requestedByCustomer: boolean
  decisionNote: string | null
  failureCode: string | null
  decidedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  payment: { publicId: string; order: { publicId: string } }
}

/**
 * Remboursements rattachés à la transaction d'origine. Demande (client ou
 * agent), puis décision par un agent habilité distinct du demandeur ;
 * l'exécution passe par le prestataire et n'est affichée « effectuée »
 * qu'après sa confirmation. Le montant ne dépasse jamais le remboursable.
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger("Billing")

  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly fulfillment: FulfillmentService,
    private readonly notifications: NotificationService,
    private readonly activity: BillingActivity,
  ) {}

  /**
   * `asCustomer` : demande du titulaire du paiement (contrôlée ici) ; sinon
   * demande d'un agent (`billing:refund_request`, contrôlée par la route).
   */
  async request(
    actor: Actor,
    paymentPublicId: string,
    input: { amount?: string; reason: string; idempotencyKey: string },
    options: { asCustomer: boolean },
    context: RequestContext,
  ): Promise<RefundView> {
    if (!isUuid(paymentPublicId)) throw billingError("PAYMENT_NOT_FOUND")
    let outcome: { publicId: string; created: boolean }
    try {
      outcome = await this.repo.transaction(async (tx) => {
        const located = await tx.paymentTransaction.findUnique({
          where: { publicId: paymentPublicId },
          select: {
            id: true,
            orderId: true,
            order: { select: { buyerId: true } },
          },
        })
        if (
          !located ||
          (options.asCustomer && located.order.buyerId !== actor.userId)
        ) {
          throw billingError("PAYMENT_NOT_FOUND")
        }
        const replay = await tx.paymentRefund.findUnique({
          where: {
            paymentId_idempotencyKey: {
              paymentId: located.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { publicId: true },
        })
        if (replay) return { publicId: replay.publicId, created: false }

        await this.repo.lockOrder(tx, located.orderId)
        await this.repo.lockPayment(tx, located.id)
        const payment = await tx.paymentTransaction.findUniqueOrThrow({
          where: { id: located.id },
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            refundedAmount: true,
            refunds: {
              where: { status: { in: [...OPEN_REFUND_STATUSES] } },
              select: { amount: true },
            },
          },
        })
        if (payment.status !== "SUCCEEDED")
          throw billingError("REFUND_NOT_ALLOWED")
        if (options.asCustomer && payment.refunds.length > 0) {
          throw billingError("REFUND_ALREADY_PENDING")
        }
        const refundable = refundableAmount(payment, payment.refunds)
        if (refundable === 0n) throw billingError("REFUND_NOT_ALLOWED")
        const amount =
          input.amount === undefined ? refundable : parseAmount(input.amount)
        if (amount === null) throw billingError("REFUND_AMOUNT_EXCEEDED")
        if (amount > refundable) throw billingError("REFUND_AMOUNT_EXCEEDED")

        const refund = await tx.paymentRefund.create({
          data: {
            paymentId: payment.id,
            amount,
            currency: payment.currency,
            reason: input.reason.trim(),
            requestedById: actor.userId,
            requestedByCustomer: options.asCustomer,
            idempotencyKey: input.idempotencyKey,
          },
          select: { publicId: true },
        })
        await this.activity.audit(
          {
            action: BillingAuditAction.REFUND_REQUESTED,
            actorId: actor.userId,
            entityType: BillingEntity.REFUND,
            entityId: refund.publicId,
            newValues: {
              payment: paymentPublicId,
              amount: amountJson(amount),
              currency: payment.currency,
              byCustomer: options.asCustomer,
              reason: input.reason.trim(),
            },
          },
          context,
          tx,
        )
        return { publicId: refund.publicId, created: true }
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw billingError("REFUND_ALREADY_PENDING")
      throw error
    }
    if (outcome.created) {
      this.activity.metrics.billing.refunds.inc({ status: "REQUESTED" })
      this.activity.emit(BillingEvent.REFUND_REQUESTED, outcome.publicId, {
        refundId: outcome.publicId,
        paymentId: paymentPublicId,
      })
      this.activity.log("billing.refund_requested", context, {
        user_id: actor.publicId,
        refund_id: outcome.publicId,
        payment_id: paymentPublicId,
        by_customer: options.asCustomer,
      })
    }
    return this.get(outcome.publicId)
  }

  async reject(
    actor: Actor,
    refundPublicId: string,
    note: string,
    context: RequestContext,
  ): Promise<RefundView> {
    await this.repo.transaction(async (tx) => {
      const refund = await this.lockRefundRow(tx, refundPublicId)
      if (refund.status !== "REQUESTED")
        throw billingError("REFUND_NOT_DECIDABLE")
      await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: "REJECTED",
          decidedById: actor.userId,
          decidedAt: new Date(),
          decisionNote: note.trim(),
        },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.REFUND_REJECTED,
          actorId: actor.userId,
          entityType: BillingEntity.REFUND,
          entityId: refundPublicId,
          oldValues: { status: "REQUESTED" },
          newValues: { status: "REJECTED", note: note.trim() },
        },
        context,
        tx,
      )
      if (refund.requestedByCustomer) {
        await this.notifications.notify(
          refund.buyerId,
          {
            type: "SYSTEM",
            category: "ACCOUNT",
            ...billingNotice.refundRejected(),
            data: { refundId: refundPublicId },
            dedupKey: `billing:refund-rejected:${refundPublicId}`,
          },
          tx,
        )
      }
    })
    this.activity.metrics.billing.refunds.inc({ status: "REJECTED" })
    return this.get(refundPublicId)
  }

  /**
   * Approbation puis exécution chez le prestataire, hors transaction ; le
   * remboursement reste « en cours » tant que le prestataire ne l'a pas
   * confirmé (réponse, notification ou réconciliation).
   */
  async approve(
    actor: Actor,
    refundPublicId: string,
    note: string,
    context: RequestContext,
  ): Promise<RefundView> {
    await this.repo.transaction(async (tx) => {
      const refund = await this.lockRefundRow(tx, refundPublicId)
      if (refund.status !== "REQUESTED")
        throw billingError("REFUND_NOT_DECIDABLE")
      if (refund.requestedById === actor.userId) {
        throw billingError("REFUND_SELF_APPROVAL")
      }
      const provider = this.providers.byCode(refund.provider)
      if (!provider?.refund || !provider.capabilities.refunds) {
        throw billingError("REFUND_NOT_SUPPORTED")
      }
      const payment = await tx.paymentTransaction.findUniqueOrThrow({
        where: { id: refund.paymentId },
        select: {
          status: true,
          amount: true,
          refundedAmount: true,
          refunds: {
            where: {
              status: { in: [...OPEN_REFUND_STATUSES] },
              id: { not: refund.id },
            },
            select: { amount: true },
          },
        },
      })
      if (refund.amount > refundableAmount(payment, payment.refunds)) {
        throw billingError("REFUND_AMOUNT_EXCEEDED")
      }
      await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSING",
          decidedById: actor.userId,
          decidedAt: new Date(),
          decisionNote: note.trim(),
        },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.REFUND_APPROVED,
          actorId: actor.userId,
          entityType: BillingEntity.REFUND,
          entityId: refundPublicId,
          oldValues: { status: "REQUESTED" },
          newValues: { status: "PROCESSING", note: note.trim() },
        },
        context,
        tx,
      )
    })
    this.activity.metrics.billing.refunds.inc({ status: "PROCESSING" })
    await this.execute(refundPublicId)
    return this.get(refundPublicId)
  }

  /**
   * Envoie (ou renvoie, la référence servant de clé d'idempotence) un
   * remboursement en cours au prestataire, puis applique sa réponse.
   */
  async execute(refundPublicId: string): Promise<void> {
    const refund = await this.repo.client.paymentRefund.findUnique({
      where: { publicId: refundPublicId },
      select: {
        status: true,
        amount: true,
        currency: true,
        providerReference: true,
        payment: { select: { provider: true, providerReference: true } },
      },
    })
    if (!refund || refund.status !== "PROCESSING") return
    const provider = this.providers.byCode(refund.payment.provider)
    if (!provider?.refund || !refund.payment.providerReference) return
    let result: ProviderRefundResult | null
    try {
      result =
        refund.providerReference && provider.fetchRefundStatus
          ? await provider.fetchRefundStatus(refund.providerReference)
          : await provider.refund({
              reference: refundPublicId,
              paymentProviderReference: refund.payment.providerReference,
              amount: refund.amount,
              currency: refund.currency,
            })
    } catch (error) {
      this.activity.metrics.billing.providerErrors.inc({
        provider: provider.code,
        operation: "refund",
      })
      this.logger.warn(
        JSON.stringify({
          action: "billing.refund_call_failed",
          refund_id: refundPublicId,
          provider: provider.code,
          error: safeErrorMessage(error),
        }),
      )
      return
    }
    if (result) await this.applyResult(refundPublicId, result)
  }

  /** Réponse du prestataire (appel direct, notification, réconciliation). */
  async applyResult(
    refundPublicId: string,
    result: ProviderRefundResult,
  ): Promise<"APPLIED" | "IGNORED"> {
    const now = new Date()
    const effects = await this.repo.transaction(async (tx) => {
      const located = await tx.paymentRefund.findUnique({
        where: { publicId: refundPublicId },
        select: {
          id: true,
          paymentId: true,
          payment: { select: { orderId: true } },
        },
      })
      if (!located) return null
      await this.repo.lockOrder(tx, located.payment.orderId)
      await this.repo.lockPayment(tx, located.paymentId)
      await this.repo.lockRefund(tx, located.id)
      const refund = await tx.paymentRefund.findUniqueOrThrow({
        where: { id: located.id },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          providerReference: true,
          requestedByCustomer: true,
          payment: {
            select: {
              id: true,
              publicId: true,
              amount: true,
              refundedAmount: true,
              order: {
                select: {
                  id: true,
                  publicId: true,
                  buyerId: true,
                  status: true,
                },
              },
            },
          },
        },
      })
      if (refund.status !== "PROCESSING") return null
      if (
        refund.providerReference &&
        refund.providerReference !== result.providerReference
      ) {
        return null
      }
      if (result.status === "PROCESSING") {
        if (!refund.providerReference) {
          await tx.paymentRefund.update({
            where: { id: refund.id },
            data: {
              providerReference: result.providerReference,
              lastCheckedAt: now,
            },
          })
        }
        return null
      }
      const payment = refund.payment
      if (result.status === "FAILED") {
        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: "FAILED",
            providerReference:
              refund.providerReference ?? result.providerReference,
            failureCode: safeFailureCode(result.failureCode) ?? "FAILED",
            lastCheckedAt: now,
          },
        })
        if (
          await this.repo.openIncident(
            tx,
            "REFUND_FAILED",
            { paymentId: payment.id, orderId: payment.order.id },
            { refund: refundPublicId },
          )
        ) {
          this.activity.metrics.billing.incidents.inc({ kind: "REFUND_FAILED" })
        }
        await this.auditStatus(tx, refundPublicId, "FAILED")
        return { status: "FAILED" as const, payment, refund, revoked: null }
      }

      const refunded = payment.refundedAmount + refund.amount
      await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: "SUCCEEDED",
          providerReference:
            refund.providerReference ?? result.providerReference,
          completedAt: now,
          lastCheckedAt: now,
        },
      })
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: { refundedAmount: refunded },
      })
      let revoked: Awaited<
        ReturnType<FulfillmentService["revokeOrderPeriod"]>
      > = null
      if (isFullRefund({ amount: payment.amount, refundedAmount: refunded })) {
        if (payment.order.status === "PAID") {
          const others = await tx.paymentTransaction.count({
            where: {
              orderId: payment.order.id,
              status: "SUCCEEDED",
              id: { not: payment.id },
            },
          })
          // Un autre paiement réussi (doublon) couvre encore la commande.
          if (others === 0) {
            await tx.billingOrder.update({
              where: { id: payment.order.id },
              data: { status: "REFUNDED", refundedAt: now },
            })
            revoked = await this.fulfillment.revokeOrderPeriod(
              tx,
              payment.order.id,
              now,
            )
          }
        }
      }
      await this.auditStatus(tx, refundPublicId, "SUCCEEDED")
      await this.notifications.notify(
        payment.order.buyerId,
        {
          type: "SYSTEM",
          category: "ACCOUNT",
          ...billingNotice.refundCompleted(
            amountJson(refund.amount),
            refund.currency,
          ),
          data: { refundId: refundPublicId, orderId: payment.order.publicId },
          dedupKey: `billing:refund-completed:${refundPublicId}`,
        },
        tx,
      )
      return { status: "SUCCEEDED" as const, payment, refund, revoked }
    })
    if (!effects) return "IGNORED"
    this.activity.metrics.billing.refunds.inc({ status: effects.status })
    if (effects.status === "SUCCEEDED") {
      this.activity.emit(BillingEvent.REFUND_COMPLETED, refundPublicId, {
        refundId: refundPublicId,
        paymentId: effects.payment.publicId,
      })
      if (effects.revoked?.ended) {
        this.activity.metrics.billing.subscriptionChanges.inc({
          change: "refund_ended",
        })
        this.activity.emit(
          BillingEvent.SUBSCRIPTION_CANCELLED,
          effects.revoked.subscriptionPublicId,
          {
            subscriptionId: effects.revoked.subscriptionPublicId,
            reason: "FULL_REFUND",
          },
        )
      }
    }
    this.activity.log("billing.refund_status", null, {
      refund_id: refundPublicId,
      status: effects.status,
    })
    return "APPLIED"
  }

  async get(refundPublicId: string): Promise<RefundView> {
    const row = isUuid(refundPublicId)
      ? await this.repo.client.paymentRefund.findUnique({
          where: { publicId: refundPublicId },
          select: refundSelect,
        })
      : null
    if (!row) throw billingError("REFUND_NOT_FOUND")
    return toRefundView(row)
  }

  /** Vue client : sans la note de décision interne. */
  async listOwn(actor: Actor): Promise<RefundView[]> {
    const rows = await this.repo.client.paymentRefund.findMany({
      where: { payment: { order: { buyerId: actor.userId } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: refundSelect,
    })
    return rows.map((row) => ({ ...toRefundView(row), decisionNote: null }))
  }

  async getOwn(actor: Actor, refundPublicId: string): Promise<RefundView> {
    const row = isUuid(refundPublicId)
      ? await this.repo.client.paymentRefund.findUnique({
          where: { publicId: refundPublicId },
          select: refundSelect,
        })
      : null
    if (!row || row.payment.order.buyerId !== actor.userId) {
      throw billingError("REFUND_NOT_FOUND")
    }
    return { ...toRefundView(row), decisionNote: null }
  }

  private async lockRefundRow(tx: Tx, publicId: string) {
    if (!isUuid(publicId)) throw billingError("REFUND_NOT_FOUND")
    const located = await tx.paymentRefund.findUnique({
      where: { publicId },
      select: {
        id: true,
        paymentId: true,
        payment: { select: { orderId: true } },
      },
    })
    if (!located) throw billingError("REFUND_NOT_FOUND")
    await this.repo.lockOrder(tx, located.payment.orderId)
    await this.repo.lockPayment(tx, located.paymentId)
    await this.repo.lockRefund(tx, located.id)
    const refund = await tx.paymentRefund.findUniqueOrThrow({
      where: { id: located.id },
      select: {
        id: true,
        paymentId: true,
        status: true,
        amount: true,
        requestedById: true,
        requestedByCustomer: true,
        payment: {
          select: { provider: true, order: { select: { buyerId: true } } },
        },
      },
    })
    return {
      ...refund,
      provider: refund.payment.provider,
      buyerId: refund.payment.order.buyerId,
    }
  }

  private auditStatus(
    tx: Tx,
    refundPublicId: string,
    status: "SUCCEEDED" | "FAILED",
  ): Promise<void> {
    return this.activity.audit(
      {
        action: BillingAuditAction.REFUND_STATUS_CHANGED,
        actorId: null,
        entityType: BillingEntity.REFUND,
        entityId: refundPublicId,
        oldValues: { status: "PROCESSING" },
        newValues: { status },
      },
      null,
      tx,
    )
  }
}

export function toRefundView(row: RefundRow): RefundView {
  return {
    id: row.publicId,
    paymentId: row.payment.publicId,
    orderId: row.payment.order.publicId,
    amount: amountJson(row.amount),
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    requestedByCustomer: row.requestedByCustomer,
    decisionNote: row.decisionNote,
    failureCode: row.failureCode,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
