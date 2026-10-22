import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import {
  DatabaseService,
  isUniqueViolation,
  type Db,
} from "../../../database/database.service"
import type { ModerationAction } from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { adminError } from "../domain/admin-errors"
import { AdminActivity, AdminAuditAction } from "./admin-activity"

export interface ModerationReasonView {
  code: string
  action: ModerationAction
  label: string
  ownerMessage: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export interface ModerationReasonInput {
  label: string
  ownerMessage: string
  isActive?: boolean
  sortOrder?: number
}

const reasonSelect = {
  code: true,
  action: true,
  label: true,
  ownerMessage: true,
  isActive: true,
  sortOrder: true,
  updatedAt: true,
} as const

/**
 * Référentiel des motifs de modération : seul paramètre métier modifiable
 * depuis le back-office. Le code est immuable (il figure dans l'historique) ;
 * un motif obsolète se désactive, il ne se supprime pas.
 */
@Injectable()
export class ModerationReasonService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: AdminActivity,
  ) {}

  async list(options: {
    action?: ModerationAction
    includeInactive?: boolean
  }): Promise<ModerationReasonView[]> {
    const rows = await this.db.client.moderationReason.findMany({
      where: {
        ...(options.action ? { action: options.action } : {}),
        ...(options.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ action: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      take: 200,
      select: reasonSelect,
    })
    return rows.map(toView)
  }

  /** Motif actif adapté à la décision, sinon 422. */
  async require(
    code: string,
    action: ModerationAction,
    db: Db = this.db.client,
  ): Promise<ModerationReasonView> {
    const row = await db.moderationReason.findUnique({
      where: { code },
      select: reasonSelect,
    })
    if (!row || !row.isActive || row.action !== action) {
      throw adminError("MODERATION_REASON_INVALID", code)
    }
    return toView(row)
  }

  async create(
    actor: Actor,
    input: ModerationReasonInput & { code: string; action: ModerationAction },
    context: RequestContext,
  ): Promise<ModerationReasonView> {
    try {
      return await this.db.transaction(async (tx) => {
        const row = await tx.moderationReason.create({
          data: {
            code: input.code,
            action: input.action,
            label: input.label.trim(),
            ownerMessage: input.ownerMessage.trim(),
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
          },
          select: reasonSelect,
        })
        await this.activity.audit(
          {
            action: AdminAuditAction.MODERATION_REASON_CREATED,
            actorId: actor.userId,
            entityType: "moderation_reason",
            entityId: row.code,
            newValues: auditValues(row),
          },
          context,
          tx,
        )
        return toView(row)
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw adminError("MODERATION_REASON_EXISTS")
      throw error
    }
  }

  async update(
    actor: Actor,
    code: string,
    input: Partial<ModerationReasonInput>,
    context: RequestContext,
  ): Promise<ModerationReasonView> {
    return this.db.transaction(async (tx) => {
      const before = await tx.moderationReason.findUnique({
        where: { code },
        select: reasonSelect,
      })
      if (!before) throw adminError("MODERATION_REASON_NOT_FOUND")
      const row = await tx.moderationReason.update({
        where: { code },
        data: {
          ...(input.label !== undefined ? { label: input.label.trim() } : {}),
          ...(input.ownerMessage !== undefined
            ? { ownerMessage: input.ownerMessage.trim() }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
        },
        select: reasonSelect,
      })
      await this.activity.audit(
        {
          action: AdminAuditAction.MODERATION_REASON_UPDATED,
          actorId: actor.userId,
          entityType: "moderation_reason",
          entityId: code,
          oldValues: auditValues(before),
          newValues: auditValues(row),
        },
        context,
        tx,
      )
      return toView(row)
    })
  }
}

type ReasonRow = {
  code: string
  action: ModerationAction
  label: string
  ownerMessage: string
  isActive: boolean
  sortOrder: number
  updatedAt: Date
}

function toView(row: ReasonRow): ModerationReasonView {
  return { ...row, updatedAt: row.updatedAt.toISOString() }
}

function auditValues(row: ReasonRow) {
  return {
    action: row.action,
    label: row.label,
    ownerMessage: row.ownerMessage,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}
