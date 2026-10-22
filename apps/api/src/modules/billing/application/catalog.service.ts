import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { isUniqueViolation, type Db } from "../../../database/database.service"
import type {
  BillingPriceStatus,
  BillingProductStatus,
} from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { billingError } from "../domain/billing-errors"
import { BillingAuditAction, BillingEntity } from "../domain/billing-events"
import { amountJson, isSupportedCurrency, parseAmount } from "../domain/money"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import { BillingActivity } from "./billing-activity"

export interface PriceView {
  id: string
  amount: string
  currency: string
  intervalMonths: number
  status: BillingPriceStatus
  validFrom: string
  validUntil: string | null
}

export interface ProductView {
  id: string
  code: string
  name: string
  description: string | null
  status: BillingProductStatus
  isDefault: boolean
  /** `null` : illimité. */
  maxActiveListings: number | null
  sortOrder: number
  /** Tarif applicable maintenant, `null` si le plan n'est pas en vente. */
  currentPrice: PriceView | null
}

export interface AdminProductView extends ProductView {
  prices: PriceView[]
  updatedAt: string
}

const priceSelect = {
  id: true,
  publicId: true,
  amount: true,
  currency: true,
  intervalMonths: true,
  status: true,
  validFrom: true,
  validUntil: true,
} as const

const productSelect = {
  id: true,
  publicId: true,
  code: true,
  name: true,
  description: true,
  status: true,
  isDefault: true,
  maxActiveListings: true,
  sortOrder: true,
  updatedAt: true,
} as const

type PriceRow = {
  publicId: string
  amount: bigint
  currency: string
  intervalMonths: number
  status: BillingPriceStatus
  validFrom: Date
  validUntil: Date | null
}

/** Tarif en vigueur : actif, commencé, non échu ; le plus récent l'emporte. */
export function currentPriceWhere(now: Date) {
  return {
    status: "ACTIVE" as const,
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
  }
}

/**
 * Catalogue des plans. Aucun prix n'est codé en dur : plans et tarifs sont
 * créés par un administrateur. Un tarif est immuable ; le changer revient à
 * en créer un nouveau et à archiver l'ancien (les commandes passées gardent
 * leur montant figé).
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly activity: BillingActivity,
  ) {}

  /** Plans en vente, avec leur tarif courant (public). */
  async listPublic(now = new Date()): Promise<ProductView[]> {
    const rows = await this.repo.client.billingProduct.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      take: 50,
      select: {
        ...productSelect,
        prices: {
          where: currentPriceWhere(now),
          orderBy: { validFrom: "desc" },
          take: 1,
          select: priceSelect,
        },
      },
    })
    return rows.map((row) => toProductView(row, row.prices[0] ?? null))
  }

  async listAdmin(now = new Date()): Promise<AdminProductView[]> {
    const rows = await this.repo.client.billingProduct.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      take: 100,
      select: {
        ...productSelect,
        prices: {
          orderBy: { validFrom: "desc" },
          take: 50,
          select: priceSelect,
        },
      },
    })
    return rows.map((row) => {
      const current =
        row.prices.find(
          (price) =>
            price.status === "ACTIVE" &&
            price.validFrom <= now &&
            (price.validUntil === null || price.validUntil > now),
        ) ?? null
      return {
        ...toProductView(row, current),
        prices: row.prices.map(toPriceView),
        updatedAt: row.updatedAt.toISOString(),
      }
    })
  }

  async createProduct(
    actor: Actor,
    input: {
      code: string
      name: string
      description?: string | null
      maxActiveListings?: number | null
      sortOrder?: number
    },
    context: RequestContext,
  ): Promise<AdminProductView> {
    try {
      await this.repo.transaction(async (tx) => {
        const row = await tx.billingProduct.create({
          data: {
            code: input.code,
            kind: "SUBSCRIPTION_PLAN",
            status: "DRAFT",
            name: input.name.trim(),
            description: input.description?.trim() || null,
            maxActiveListings: input.maxActiveListings ?? null,
            sortOrder: input.sortOrder ?? 0,
          },
          select: productSelect,
        })
        await this.activity.audit(
          {
            action: BillingAuditAction.PRODUCT_CREATED,
            actorId: actor.userId,
            entityType: BillingEntity.PRODUCT,
            entityId: row.publicId,
            newValues: productAudit(row),
          },
          context,
          tx,
        )
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw billingError("PRODUCT_CODE_EXISTS")
      throw error
    }
    return this.requireAdminProduct(input.code)
  }

  async updateProduct(
    actor: Actor,
    code: string,
    input: {
      name?: string
      description?: string | null
      status?: BillingProductStatus
      maxActiveListings?: number | null
      sortOrder?: number
    },
    context: RequestContext,
  ): Promise<AdminProductView> {
    await this.repo.transaction(async (tx) => {
      const before = await this.lockProduct(tx, code)
      if (before.isDefault && input.status && input.status !== "ACTIVE") {
        throw billingError("PRODUCT_DEFAULT_LOCKED")
      }
      const row = await tx.billingProduct.update({
        where: { id: before.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.maxActiveListings !== undefined
            ? { maxActiveListings: input.maxActiveListings }
            : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
        },
        select: productSelect,
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.PRODUCT_UPDATED,
          actorId: actor.userId,
          entityType: BillingEntity.PRODUCT,
          entityId: row.publicId,
          oldValues: productAudit(before),
          newValues: productAudit(row),
        },
        context,
        tx,
      )
    })
    return this.requireAdminProduct(code)
  }

  async createPrice(
    actor: Actor,
    code: string,
    input: {
      amount: string
      currency: string
      intervalMonths: number
      validFrom?: Date
    },
    context: RequestContext,
  ): Promise<AdminProductView> {
    const amount = parseAmount(input.amount)
    if (amount === null) throw billingError("PRICE_INVALID", "montant")
    if (!isSupportedCurrency(input.currency)) {
      throw billingError("CURRENCY_NOT_SUPPORTED", input.currency)
    }
    if (
      !Number.isInteger(input.intervalMonths) ||
      input.intervalMonths < 1 ||
      input.intervalMonths > 24
    ) {
      throw billingError("PRICE_INVALID", "période")
    }
    await this.repo.transaction(async (tx) => {
      const product = await this.lockProduct(tx, code)
      if (product.isDefault) throw billingError("PRODUCT_DEFAULT_LOCKED")
      const price = await tx.billingPrice.create({
        data: {
          productId: product.id,
          amount,
          currency: input.currency,
          intervalMonths: input.intervalMonths,
          ...(input.validFrom ? { validFrom: input.validFrom } : {}),
          createdById: actor.userId,
        },
        select: priceSelect,
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.PRICE_CREATED,
          actorId: actor.userId,
          entityType: BillingEntity.PRICE,
          entityId: price.publicId,
          newValues: {
            product: product.code,
            amount: amountJson(price.amount),
            currency: price.currency,
            intervalMonths: price.intervalMonths,
            validFrom: price.validFrom.toISOString(),
          },
        },
        context,
        tx,
      )
    })
    return this.requireAdminProduct(code)
  }

  async archivePrice(
    actor: Actor,
    pricePublicId: string,
    context: RequestContext,
  ): Promise<void> {
    if (!isUuid(pricePublicId)) throw billingError("PRICE_NOT_FOUND")
    await this.repo.transaction(async (tx) => {
      const price = await tx.billingPrice.findUnique({
        where: { publicId: pricePublicId },
        select: { id: true, status: true },
      })
      if (!price) throw billingError("PRICE_NOT_FOUND")
      if (price.status === "ARCHIVED") return
      await tx.billingPrice.update({
        where: { id: price.id },
        data: { status: "ARCHIVED" },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.PRICE_ARCHIVED,
          actorId: actor.userId,
          entityType: BillingEntity.PRICE,
          entityId: pricePublicId,
          oldValues: { status: "ACTIVE" },
          newValues: { status: "ARCHIVED" },
        },
        context,
        tx,
      )
    })
  }

  private async lockProduct(tx: Db, code: string) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM billing_products WHERE code = ${code} FOR UPDATE`
    const id = rows[0]?.id
    if (id === undefined) throw billingError("PRODUCT_NOT_FOUND")
    return tx.billingProduct.findUniqueOrThrow({
      where: { id },
      select: productSelect,
    })
  }

  private async requireAdminProduct(code: string): Promise<AdminProductView> {
    const product = (await this.listAdmin()).find((item) => item.code === code)
    if (!product) throw billingError("PRODUCT_NOT_FOUND")
    return product
  }
}

function toPriceView(row: PriceRow): PriceView {
  return {
    id: row.publicId,
    amount: amountJson(row.amount),
    currency: row.currency,
    intervalMonths: row.intervalMonths,
    status: row.status,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil?.toISOString() ?? null,
  }
}

function toProductView(
  row: {
    publicId: string
    code: string
    name: string
    description: string | null
    status: BillingProductStatus
    isDefault: boolean
    maxActiveListings: number | null
    sortOrder: number
  },
  price: PriceRow | null,
): ProductView {
  return {
    id: row.publicId,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    isDefault: row.isDefault,
    maxActiveListings: row.maxActiveListings,
    sortOrder: row.sortOrder,
    currentPrice: row.isDefault || !price ? null : toPriceView(price),
  }
}

function productAudit(row: {
  code: string
  name: string
  status: BillingProductStatus
  maxActiveListings: number | null
  sortOrder: number
}) {
  return {
    code: row.code,
    name: row.name,
    status: row.status,
    maxActiveListings: row.maxActiveListings,
    sortOrder: row.sortOrder,
  }
}
