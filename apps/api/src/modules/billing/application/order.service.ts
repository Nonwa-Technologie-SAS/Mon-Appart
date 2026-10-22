import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { isUniqueViolation, type Tx } from "../../../database/database.service"
import type {
  BillingOrderKind,
  BillingOrderStatus,
} from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { BillingConfig } from "../billing.config"
import { billingError } from "../domain/billing-errors"
import {
  BillingAuditAction,
  BillingEntity,
  BillingEvent,
} from "../domain/billing-events"
import { amountJson, isSupportedCurrency } from "../domain/money"
import {
  isOrderCancellable,
  OPEN_PAYMENT_STATUSES,
} from "../domain/payment-rules"
import {
  CURRENT_SUBSCRIPTION_STATUSES,
  isRenewalOpen,
} from "../domain/subscription-rules"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { BillingActivity } from "./billing-activity"
import { currentPriceWhere } from "./catalog.service"
import { expireOrderInTx } from "./order-expiry"
import { pageOf, type Page } from "./pagination"
import {
  paymentSelect,
  toPaymentView,
  type PaymentView,
} from "./payment.service"

export interface OrderView {
  id: string
  kind: BillingOrderKind
  status: BillingOrderStatus
  product: { code: string; name: string }
  /** Montant figé à la création ; jamais recalculé depuis le catalogue. */
  amount: string
  currency: string
  intervalMonths: number
  maxActiveListings: number | null
  expiresAt: string
  paidAt: string | null
  fulfilled: boolean
  cancelledAt: string | null
  refundedAt: string | null
  createdAt: string
}

export interface OrderDetailView extends OrderView {
  payments: PaymentView[]
}

export const RECEIPT_NOTICE =
  "Reçu de paiement pour un service de la plateforme. Ce document n'est pas une facture et n'a pas de valeur fiscale."

export interface ReceiptView {
  documentType: "PAYMENT_RECEIPT"
  isTaxInvoice: false
  notice: string
  orderId: string
  paymentId: string
  product: { code: string; name: string }
  intervalMonths: number
  amount: string
  refundedAmount: string
  currency: string
  provider: string
  environment: PaymentView["environment"]
  paidAt: string | null
  issuedAt: string
}

export const orderSelect = {
  publicId: true,
  kind: true,
  status: true,
  productCode: true,
  productName: true,
  amount: true,
  currency: true,
  intervalMonths: true,
  maxActiveListings: true,
  expiresAt: true,
  paidAt: true,
  fulfilledAt: true,
  cancelledAt: true,
  refundedAt: true,
  createdAt: true,
} as const

type OrderRow = {
  publicId: string
  kind: BillingOrderKind
  status: BillingOrderStatus
  productCode: string
  productName: string
  amount: bigint
  currency: string
  intervalMonths: number
  maxActiveListings: number | null
  expiresAt: Date
  paidAt: Date | null
  fulfilledAt: Date | null
  cancelledAt: Date | null
  refundedAt: Date | null
  createdAt: Date
}

/**
 * Commandes : le serveur choisit le tarif en vigueur et fige le contenu
 * (montant, devise, durée, droits). Le client n'envoie qu'un code de plan et
 * une clé d'idempotence ; jamais un montant ni un identifiant d'acheteur.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly activity: BillingActivity,
    private readonly config: BillingConfig,
  ) {}

  async create(
    actor: Actor,
    input: { productCode: string; idempotencyKey: string },
    context: RequestContext,
  ): Promise<OrderView> {
    if (!this.providers.active()) throw billingError("BILLING_UNAVAILABLE")
    const now = new Date()
    let created: { publicId: string; kind: BillingOrderKind } | null = null
    try {
      created = await this.repo.transaction(async (tx) => {
        await this.repo.lockAccount(tx, actor.userId)
        const replay = await this.findByKey(tx, actor, input)
        if (replay) return null
        await this.expireStale(tx, actor.userId, now)

        const product = await tx.billingProduct.findUnique({
          where: { code: input.productCode },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            isDefault: true,
            maxActiveListings: true,
            prices: {
              where: currentPriceWhere(now),
              orderBy: { validFrom: "desc" },
              take: 1,
              select: {
                id: true,
                amount: true,
                currency: true,
                intervalMonths: true,
              },
            },
          },
        })
        if (!product) throw billingError("PRODUCT_NOT_FOUND")
        const price = product.prices[0]
        if (product.status !== "ACTIVE" || product.isDefault || !price) {
          throw billingError("PRODUCT_NOT_PURCHASABLE")
        }
        if (!isSupportedCurrency(price.currency)) {
          throw billingError("CURRENCY_NOT_SUPPORTED", price.currency)
        }

        const current = await tx.subscription.findFirst({
          where: {
            userId: actor.userId,
            status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
          },
          select: {
            id: true,
            productId: true,
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        })
        let kind: BillingOrderKind = "SUBSCRIPTION_START"
        if (current) {
          if (current.productId !== product.id) {
            throw billingError("PLAN_CHANGE_NOT_SUPPORTED")
          }
          if (!isRenewalOpen(current, now, this.config.renewalWindowDays)) {
            throw billingError("RENEWAL_NOT_OPEN")
          }
          kind = "SUBSCRIPTION_RENEWAL"
        }

        const order = await tx.billingOrder.create({
          data: {
            buyerId: actor.userId,
            kind,
            productId: product.id,
            priceId: price.id,
            subscriptionId:
              kind === "SUBSCRIPTION_RENEWAL" ? current!.id : null,
            productCode: product.code,
            productName: product.name,
            amount: price.amount,
            currency: price.currency,
            intervalMonths: price.intervalMonths,
            maxActiveListings: product.maxActiveListings,
            idempotencyKey: input.idempotencyKey,
            expiresAt: new Date(now.getTime() + this.config.orderTtlMs),
          },
          select: { publicId: true, kind: true },
        })
        await this.activity.audit(
          {
            action: BillingAuditAction.ORDER_CREATED,
            actorId: actor.userId,
            entityType: BillingEntity.ORDER,
            entityId: order.publicId,
            newValues: {
              kind,
              product: product.code,
              amount: amountJson(price.amount),
              currency: price.currency,
              intervalMonths: price.intervalMonths,
            },
          },
          context,
          tx,
        )
        return order
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        const replay = await this.findByKey(this.repo.client, actor, input)
        if (replay) return replay
        throw billingError("ORDER_ALREADY_PENDING")
      }
      throw error
    }

    if (!created) {
      const replay = await this.findByKey(this.repo.client, actor, input)
      if (!replay) throw billingError("ORDER_NOT_FOUND")
      return replay
    }
    this.activity.metrics.billing.ordersCreated.inc({ kind: created.kind })
    this.activity.emit(BillingEvent.CHECKOUT_STARTED, created.publicId, {
      orderId: created.publicId,
    })
    this.activity.log("billing.order_created", context, {
      user_id: actor.publicId,
      order_id: created.publicId,
      kind: created.kind,
      product: input.productCode,
    })
    return this.getOwn(actor, created.publicId)
  }

  async listOwn(
    actor: Actor,
    query: { cursor?: string; limit?: number },
  ): Promise<Page<OrderView>> {
    const limit = clampLimit(query.limit)
    if (query.cursor && !isUuid(query.cursor)) {
      throw billingError("BILLING_CURSOR_INVALID")
    }
    const rows = await this.repo.client.billingOrder.findMany({
      where: { buyerId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
      select: orderSelect,
    })
    return pageOf(rows, limit, toOrderView)
  }

  async getOwn(actor: Actor, publicId: string): Promise<OrderDetailView> {
    const row = isUuid(publicId)
      ? await this.repo.client.billingOrder.findUnique({
          where: { publicId },
          select: {
            ...orderSelect,
            buyerId: true,
            payments: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: paymentSelect,
            },
          },
        })
      : null
    if (!row || row.buyerId !== actor.userId) {
      throw billingError("ORDER_NOT_FOUND")
    }
    return { ...toOrderView(row), payments: row.payments.map(toPaymentView) }
  }

  /**
   * Reçu de paiement : relevé des données confirmées par le prestataire. Ce
   * n'est pas une facture ; sa conformité fiscale n'a pas été validée.
   */
  async receipt(actor: Actor, publicId: string): Promise<ReceiptView> {
    const order = await this.getOwn(actor, publicId)
    const payment = order.payments.find((item) => item.status === "SUCCEEDED")
    if (!payment || (order.status !== "PAID" && order.status !== "REFUNDED")) {
      throw billingError("RECEIPT_NOT_AVAILABLE")
    }
    return {
      documentType: "PAYMENT_RECEIPT",
      isTaxInvoice: false,
      notice: RECEIPT_NOTICE,
      orderId: order.id,
      paymentId: payment.id,
      product: order.product,
      intervalMonths: order.intervalMonths,
      amount: payment.amount,
      refundedAmount: payment.refundedAmount,
      currency: payment.currency,
      provider: payment.provider,
      environment: payment.environment,
      paidAt: payment.succeededAt,
      issuedAt: new Date().toISOString(),
    }
  }

  /**
   * Annulation par le client d'une commande en attente. Une tentative déjà
   * engagée chez le prestataire peut encore aboutir : elle serait alors
   * appliquée (paiement tardif signalé aux administrateurs).
   */
  async cancel(
    actor: Actor,
    publicId: string,
    context: RequestContext,
  ): Promise<OrderDetailView> {
    await this.repo.transaction(async (tx) => {
      const id = await this.repo.lockOrderByPublicId(tx, publicId)
      const order = id
        ? await tx.billingOrder.findUnique({
            where: { id },
            select: { id: true, buyerId: true, status: true },
          })
        : null
      if (!order || order.buyerId !== actor.userId) {
        throw billingError("ORDER_NOT_FOUND")
      }
      if (!isOrderCancellable(order.status)) {
        throw billingError("ORDER_NOT_CANCELLABLE")
      }
      const now = new Date()
      await tx.billingOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: now },
      })
      await tx.paymentTransaction.updateMany({
        where: {
          orderId: order.id,
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        data: {
          status: "CANCELLED",
          failedAt: now,
          failureCode: "ORDER_CANCELLED",
        },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.ORDER_CANCELLED,
          actorId: actor.userId,
          entityType: BillingEntity.ORDER,
          entityId: publicId,
          oldValues: { status: "PENDING" },
          newValues: { status: "CANCELLED" },
        },
        context,
        tx,
      )
    })
    return this.getOwn(actor, publicId)
  }

  private async findByKey(
    db: Tx | BillingRepository["client"],
    actor: Actor,
    input: { productCode: string; idempotencyKey: string },
  ): Promise<OrderView | null> {
    const row = await db.billingOrder.findUnique({
      where: {
        buyerId_idempotencyKey: {
          buyerId: actor.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: orderSelect,
    })
    if (!row) return null
    if (row.productCode !== input.productCode) {
      throw billingError("IDEMPOTENCY_KEY_REUSED")
    }
    return toOrderView(row)
  }

  /** Libère l'emplacement « une commande en attente » si elle est échue. */
  private async expireStale(tx: Tx, buyerId: bigint, now: Date): Promise<void> {
    const stale = await tx.billingOrder.findFirst({
      where: { buyerId, status: "PENDING", expiresAt: { lte: now } },
      select: { id: true },
    })
    if (!stale) return
    await this.repo.lockOrder(tx, stale.id)
    await expireOrderInTx(tx, this.activity, stale.id, now)
  }
}

export function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 20, 1), 100)
}

export function toOrderView(row: OrderRow): OrderView {
  return {
    id: row.publicId,
    kind: row.kind,
    status: row.status,
    product: { code: row.productCode, name: row.productName },
    amount: amountJson(row.amount),
    currency: row.currency,
    intervalMonths: row.intervalMonths,
    maxActiveListings: row.maxActiveListings,
    expiresAt: row.expiresAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    fulfilled: row.fulfilledAt !== null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
