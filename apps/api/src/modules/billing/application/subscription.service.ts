import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import type { SubscriptionStatus } from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { BillingConfig } from "../billing.config"
import { billingError } from "../domain/billing-errors"
import {
  BillingAuditAction,
  BillingEntity,
  BillingEvent,
} from "../domain/billing-events"
import {
  addDays,
  CURRENT_SUBSCRIPTION_STATUSES,
  isRenewalOpen,
} from "../domain/subscription-rules"
import { countLiveListings, loadListingEntitlement } from "../entitlements"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import { BillingActivity } from "./billing-activity"

export interface SubscriptionView {
  id: string
  status: SubscriptionStatus
  product: { code: string; name: string }
  maxActiveListings: number | null
  intervalMonths: number
  currentPeriodStart: string
  currentPeriodEnd: string
  /** Fin des droits si non renouvelé (échéance + délai de grâce). */
  graceEndsAt: string
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
  endedAt: string | null
  /** Renouvellement manuel possible maintenant (aucun prélèvement automatique). */
  renewalOpen: boolean
  createdAt: string
}

export interface EntitlementView {
  maxActiveListings: number | null
  activeListings: number
  source: "SUBSCRIPTION" | "DEFAULT_PLAN" | "NONE"
  productCode: string | null
  subscription: SubscriptionView | null
}

export const subscriptionSelect = {
  publicId: true,
  status: true,
  maxActiveListings: true,
  intervalMonths: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  cancelledAt: true,
  endedAt: true,
  createdAt: true,
  product: { select: { code: true, name: true } },
} as const

type SubscriptionRow = {
  publicId: string
  status: SubscriptionStatus
  maxActiveListings: number | null
  intervalMonths: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  cancelledAt: Date | null
  endedAt: Date | null
  createdAt: Date
  product: { code: string; name: string }
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly activity: BillingActivity,
    private readonly config: BillingConfig,
  ) {}

  async listOwn(actor: Actor): Promise<SubscriptionView[]> {
    const rows = await this.repo.client.subscription.findMany({
      where: { userId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: subscriptionSelect,
    })
    const now = new Date()
    return rows.map((row) => this.toView(row, now))
  }

  /** Droits effectifs, recalculés comme lors d'une publication d'annonce. */
  async entitlementOf(actor: Actor): Promise<EntitlementView> {
    const now = new Date()
    const db = this.repo.client
    const [entitlement, activeListings, current] = await Promise.all([
      loadListingEntitlement(db, actor.userId, now, this.config.graceDays),
      countLiveListings(db, actor.userId),
      db.subscription.findFirst({
        where: {
          userId: actor.userId,
          status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
        },
        select: subscriptionSelect,
      }),
    ])
    return {
      ...entitlement,
      activeListings,
      subscription: current ? this.toView(current, now) : null,
    }
  }

  /**
   * Résiliation : aucun renouvellement ne sera proposé, les droits payés
   * restent acquis jusqu'à l'échéance. Sans remboursement automatique.
   */
  async cancel(
    actor: Actor,
    publicId: string,
    context: RequestContext,
  ): Promise<SubscriptionView> {
    if (!isUuid(publicId)) throw billingError("SUBSCRIPTION_NOT_FOUND")
    const changed = await this.repo.transaction(async (tx) => {
      await this.repo.lockAccount(tx, actor.userId)
      const row = await tx.subscription.findUnique({
        where: { publicId },
        select: {
          id: true,
          userId: true,
          status: true,
          cancelAtPeriodEnd: true,
        },
      })
      if (!row || row.userId !== actor.userId) {
        throw billingError("SUBSCRIPTION_NOT_FOUND")
      }
      if (row.status !== "ACTIVE" && row.status !== "PAST_DUE") {
        throw billingError("SUBSCRIPTION_NOT_ACTIVE")
      }
      if (row.cancelAtPeriodEnd) return false
      const now = new Date()
      await tx.subscription.update({
        where: { id: row.id },
        data: { cancelAtPeriodEnd: true, cancelledAt: now },
      })
      await this.activity.audit(
        {
          action: BillingAuditAction.SUBSCRIPTION_CANCEL_REQUESTED,
          actorId: actor.userId,
          entityType: BillingEntity.SUBSCRIPTION,
          entityId: publicId,
          oldValues: { cancelAtPeriodEnd: false },
          newValues: { cancelAtPeriodEnd: true },
        },
        context,
        tx,
      )
      return true
    })
    if (changed) {
      this.activity.metrics.billing.subscriptionChanges.inc({
        change: "cancel_requested",
      })
      this.activity.emit(BillingEvent.SUBSCRIPTION_CANCELLED, publicId, {
        subscriptionId: publicId,
        reason: "USER_REQUEST",
      })
      this.activity.log("billing.subscription_cancel_requested", context, {
        user_id: actor.publicId,
        subscription_id: publicId,
      })
    }
    const row = await this.repo.client.subscription.findUniqueOrThrow({
      where: { publicId },
      select: subscriptionSelect,
    })
    return this.toView(row, new Date())
  }

  toView(row: SubscriptionRow, now: Date): SubscriptionView {
    return toSubscriptionView(row, now, this.config)
  }
}

export function toSubscriptionView(
  row: SubscriptionRow,
  now: Date,
  config: { graceDays: number; renewalWindowDays: number },
): SubscriptionView {
  return {
    id: row.publicId,
    status: row.status,
    product: row.product,
    maxActiveListings: row.maxActiveListings,
    intervalMonths: row.intervalMonths,
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd.toISOString(),
    graceEndsAt: addDays(row.currentPeriodEnd, config.graceDays).toISOString(),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    renewalOpen: isRenewalOpen(row, now, config.renewalWindowDays),
    createdAt: row.createdAt.toISOString(),
  }
}
