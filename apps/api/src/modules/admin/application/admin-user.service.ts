import { Injectable } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { DatabaseService } from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type { UserStatus } from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import {
  AccountAdminService,
  can,
  parseIdentifier,
  statusForDecision,
  type AccountDecision,
  type Actor,
} from "../../identity"
import { adminError } from "../domain/admin-errors"
import {
  assertCanChangeRole,
  assertCanDecide,
  canAdministerTarget,
  canDecide,
  canRevokeSessions,
  manageableRoles,
  maskEmail,
  maskPhone,
} from "../domain/admin-policy"
import { AdminActivity, AdminAuditAction } from "./admin-activity"
import { AdminAuditService, type AuditEntryView } from "./admin-audit.service"
import {
  AdminNoteService,
  displayName,
  type AdminNoteView,
} from "./admin-note.service"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PHONE_LIKE = /^\+?[0-9][0-9 .-]{5,}$/
const DECISIONS: readonly AccountDecision[] = ["SUSPEND", "BAN", "REACTIVATE"]

export interface UserSearchQuery {
  q?: string
  status?: UserStatus
  role?: Role
  cursor?: string
  limit?: number
}

export interface AdminUserSummary {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  emailVerified: boolean
  phoneVerified: boolean
  status: UserStatus
  roles: Role[]
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminUserDetail extends AdminUserSummary {
  contactRevealed: boolean
  activity: {
    activeSessions: number
    listingsByStatus: Record<string, number>
    managedProperties: number
    reportsFiled: number
    openReportsAgainst: number
    openSignals: number
  }
  verifications: Array<{
    id: string
    type: string
    status: string
    submittedAt: string | null
    decidedAt: string | null
  }>
  notes: AdminNoteView[]
  audit: AuditEntryView[] | null
  actions: {
    decisions: AccountDecision[]
    revokeSessions: boolean
    addNote: boolean
    manageableRoles: Role[]
  }
}

const summarySelect = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  roles: { select: { role: { select: { code: true } } } },
} satisfies Prisma.UserSelect

type SummaryRow = Prisma.UserGetPayload<{ select: typeof summarySelect }>

/**
 * Comptes vus du back-office. Les écritures passent par `AccountAdminService`
 * (Identity) ; ici, les droits de l'acteur sur la cible et les vues.
 */
@Injectable()
export class AdminUserService {
  constructor(
    private readonly db: DatabaseService,
    private readonly accounts: AccountAdminService,
    private readonly notes: AdminNoteService,
    private readonly audit: AdminAuditService,
    private readonly notifications: NotificationService,
    private readonly activity: AdminActivity,
  ) {}

  async search(
    actor: Actor,
    query: UserSearchQuery,
  ): Promise<{ items: AdminUserSummary[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50)
    const where: Prisma.UserWhereInput = { deletedAt: null }
    if (query.status) where.status = query.status
    if (query.role) where.roles = { some: { role: { code: query.role } } }
    const q = query.q?.trim()
    if (q) Object.assign(where, this.textFilter(actor, q))
    if (query.cursor && !UUID.test(query.cursor)) {
      throw adminError("ADMIN_CURSOR_INVALID")
    }

    const rows = await this.db.client.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select: summarySelect,
    })
    const page = rows.slice(0, limit)
    return {
      items: page.map((row) => toSummary(row, false)),
      nextCursor: rows.length > limit ? page[page.length - 1]!.publicId : null,
    }
  }

  async detail(
    actor: Actor,
    publicId: string,
    context: RequestContext,
  ): Promise<AdminUserDetail> {
    const user = await this.db.client.user.findFirst({
      where: { publicId, deletedAt: null },
      select: summarySelect,
    })
    if (!user) throw adminError("USER_NOT_FOUND")
    const now = new Date()
    const reveal = can(actor, "user:pii")
    const [
      activeSessions,
      listings,
      managedProperties,
      reportsFiled,
      openReportsAgainst,
      openSignals,
      verifications,
      notes,
      audit,
    ] = await Promise.all([
      this.db.client.authSession.count({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.db.client.listing.groupBy({
        by: ["status"],
        where: { createdById: user.id, deletedAt: null },
        _count: { _all: true },
      }),
      this.db.client.propertyOwnership.count({
        where: { ownerId: user.id, isCurrent: true },
      }),
      this.db.client.report.count({ where: { reporterId: user.id } }),
      this.db.client.report.count({
        where: { targetUserId: user.id, status: { in: ["OPEN", "IN_REVIEW"] } },
      }),
      this.db.client.trustSignal.count({
        where: { userId: user.id, status: "OPEN" },
      }),
      this.db.client.verification.findMany({
        where: { userId: user.id, status: { not: "DRAFT" } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          publicId: true,
          type: true,
          status: true,
          submittedAt: true,
          decidedAt: true,
        },
      }),
      this.notes.list("user", user.publicId),
      can(actor, "audit_log:read")
        ? this.audit.forEntity("user", user.publicId, 20)
        : Promise.resolve(null),
    ])

    if (reveal && (user.email || user.phone)) {
      await this.activity.audit(
        {
          action: AdminAuditAction.USER_CONTACT_VIEWED,
          actorId: actor.userId,
          entityType: "user",
          entityId: user.publicId,
        },
        context,
        this.db.client,
      )
    }

    const roles = rolesOf(user)
    const target = { publicId: user.publicId, roles }
    const hasVerifiedContact = Boolean(
      (user.email && user.emailVerifiedAt) ||
      (user.phone && user.phoneVerifiedAt),
    )
    return {
      ...toSummary(user, reveal),
      contactRevealed: reveal,
      activity: {
        activeSessions,
        listingsByStatus: Object.fromEntries(
          listings.map((row) => [row.status, row._count._all]),
        ),
        managedProperties,
        reportsFiled,
        openReportsAgainst,
        openSignals,
      },
      verifications: verifications.map((row) => ({
        id: row.publicId,
        type: row.type,
        status: row.status,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        decidedAt: row.decidedAt?.toISOString() ?? null,
      })),
      notes,
      audit,
      actions: {
        decisions: DECISIONS.filter(
          (decision) =>
            canDecide(actor, target, decision) &&
            statusForDecision(decision, user.status, hasVerifiedContact) !==
              null,
        ),
        revokeSessions: canRevokeSessions(actor, target) && activeSessions > 0,
        addNote: can(actor, "admin_note:create"),
        manageableRoles:
          actor.publicId !== user.publicId && canAdministerTarget(actor, roles)
            ? manageableRoles(actor)
            : [],
      },
    }
  }

  async decide(
    actor: Actor,
    publicId: string,
    decision: AccountDecision,
    input: { reason: string; expectedStatus: UserStatus },
    context: RequestContext,
  ) {
    const target = await this.target(publicId)
    assertCanDecide(actor, target, decision)
    const result = await this.accounts.decide(
      actor.publicId,
      publicId,
      decision,
      input.reason,
      context,
      { expectedStatus: input.expectedStatus },
    )
    if (decision === "REACTIVATE") {
      // Après validation : un échec d'envoi n'annule pas la réactivation.
      await this.notifications.notify(target.id, {
        type: "SYSTEM",
        category: "ACCOUNT",
        title: "Compte réactivé",
        body: "Votre compte Mon Appart est de nouveau accessible.",
        data: { status: result.to },
      })
    }
    this.activity.log(`admin.user_${decision.toLowerCase()}`, context, {
      user_id: actor.publicId,
      target_id: publicId,
      from: result.from,
      to: result.to,
    })
    return result
  }

  async revokeSessions(
    actor: Actor,
    publicId: string,
    reason: string,
    context: RequestContext,
  ): Promise<{ revokedSessions: number }> {
    const target = await this.target(publicId)
    if (!canRevokeSessions(actor, target)) {
      throw adminError("ADMIN_TARGET_PROTECTED")
    }
    const result = await this.accounts.revokeSessions(
      actor.publicId,
      publicId,
      reason,
      context,
    )
    this.activity.log("admin.user_sessions_revoked", context, {
      user_id: actor.publicId,
      target_id: publicId,
      sessions: result.revokedSessions,
    })
    return result
  }

  async changeRole(
    actor: Actor,
    publicId: string,
    role: Role,
    operation: "grant" | "revoke",
    reason: string,
    context: RequestContext,
  ): Promise<{ changed: boolean; roles: Role[] }> {
    const target = await this.target(publicId)
    assertCanChangeRole(actor, target, role)
    const result = await this.accounts.changeRole(
      actor.publicId,
      publicId,
      role,
      operation,
      context,
      reason,
    )
    this.activity.log("admin.user_role_changed", context, {
      user_id: actor.publicId,
      target_id: publicId,
      role,
      operation,
      changed: result.changed,
    })
    const after = await this.target(publicId)
    return { changed: result.changed, roles: after.roles }
  }

  addNote(
    actor: Actor,
    publicId: string,
    body: string,
    context: RequestContext,
  ): Promise<AdminNoteView> {
    return this.notes.add(actor, "user", publicId, body, context)
  }

  private async target(
    publicId: string,
  ): Promise<{ id: bigint; publicId: string; roles: Role[] }> {
    const user = await this.db.client.user.findFirst({
      where: { publicId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    })
    if (!user) throw adminError("USER_NOT_FOUND")
    return { id: user.id, publicId: user.publicId, roles: rolesOf(user) }
  }

  /**
   * Identifiant public exact, e-mail ou téléphone exact (agents habilités
   * seulement : pas d'énumération des coordonnées), sinon nom partiel.
   */
  private textFilter(actor: Actor, q: string): Prisma.UserWhereInput {
    if (UUID.test(q)) return { publicId: q.toLowerCase() }
    if (q.includes("@") || PHONE_LIKE.test(q)) {
      if (!can(actor, "user:pii")) {
        throw adminError("ADMIN_CONTACT_SEARCH_FORBIDDEN")
      }
      const identifier = parseIdentifier(q)
      if (!identifier) throw adminError("ADMIN_QUERY_INVALID", "coordonnée")
      return identifier.kind === "email"
        ? { email: identifier.value }
        : { phone: identifier.value }
    }
    if (q.length < 2 || q.length > 100) {
      throw adminError("ADMIN_QUERY_INVALID", "2 à 100 caractères")
    }
    return {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    }
  }
}

function rolesOf(user: { roles: Array<{ role: { code: string } }> }): Role[] {
  return user.roles.map((entry) => entry.role.code as Role).sort()
}

function toSummary(row: SummaryRow, reveal: boolean): AdminUserSummary {
  return {
    id: row.publicId,
    name: displayName(row),
    email: reveal ? row.email : maskEmail(row.email),
    phone: reveal ? row.phone : maskPhone(row.phone),
    emailVerified: Boolean(row.email && row.emailVerifiedAt),
    phoneVerified: Boolean(row.phone && row.phoneVerifiedAt),
    status: row.status,
    roles: rolesOf(row),
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  }
}
