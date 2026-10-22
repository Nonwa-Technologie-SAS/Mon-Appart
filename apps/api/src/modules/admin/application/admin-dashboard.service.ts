import { Injectable } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

import { DatabaseService } from "../../../database/database.service"
import { can, type Actor } from "../../identity"
import { manageableRoles } from "../domain/admin-policy"

export interface QueueWidget {
  key: string
  label: string
  definition: string
  value: number
  /** Plus ancien élément de la file, `null` si elle est vide. */
  oldestAt: string | null
  /** Page du back-office qui traite la file. */
  link: string
}

const DAY_MS = 86_400_000

/**
 * Files de travail calculées à la demande, en direct (pas d'agrégat
 * analytique) : chaque widget n'apparaît qu'avec la permission qui permet de
 * traiter la file. Les indicateurs d'usage viennent de `admin/analytics`.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(actor: Actor) {
    const db = this.db.client
    const widgets: Array<Promise<QueueWidget>> = []

    if (can(actor, "listing:moderate")) {
      widgets.push(
        db.listing
          .aggregate({
            where: { status: "PENDING_REVIEW", deletedAt: null },
            _count: { _all: true },
            _min: { updatedAt: true },
          })
          .then((row) => ({
            key: "listings_pending_review",
            label: "Annonces à valider",
            definition: "Annonces au statut PENDING_REVIEW, non supprimées.",
            value: row._count._all,
            oldestAt: row._min.updatedAt?.toISOString() ?? null,
            link: "/listings?status=PENDING_REVIEW",
          })),
      )
    }
    if (can(actor, "listing:suspend")) {
      widgets.push(
        db.listing
          .aggregate({
            where: { status: "SUSPENDED", deletedAt: null },
            _count: { _all: true },
            _min: { updatedAt: true },
          })
          .then((row) => ({
            key: "listings_suspended",
            label: "Annonces suspendues",
            definition:
              "Annonces au statut SUSPENDED, en attente de restauration ou de clôture.",
            value: row._count._all,
            oldestAt: row._min.updatedAt?.toISOString() ?? null,
            link: "/listings?status=SUSPENDED",
          })),
      )
    }
    if (can(actor, "report:review")) {
      widgets.push(
        db.report
          .aggregate({
            where: { status: { in: ["OPEN", "IN_REVIEW"] } },
            _count: { _all: true },
            _min: { createdAt: true },
          })
          .then((row) => ({
            key: "reports_open",
            label: "Signalements à traiter",
            definition:
              "Signalements OPEN ou IN_REVIEW. Un signalement est une allégation à instruire.",
            value: row._count._all,
            oldestAt: row._min.createdAt?.toISOString() ?? null,
            link: "/reports",
          })),
      )
    }
    if (can(actor, "verification:read")) {
      widgets.push(
        db.verification
          .aggregate({
            where: { status: { in: ["PENDING", "IN_REVIEW"] } },
            _count: { _all: true },
            _min: { submittedAt: true },
          })
          .then((row) => ({
            key: "verifications_awaiting_review",
            label: "Vérifications à examiner",
            definition: "Dossiers soumis au statut PENDING ou IN_REVIEW.",
            value: row._count._all,
            oldestAt: row._min.submittedAt?.toISOString() ?? null,
            link: "/verifications",
          })),
      )
    }
    if (can(actor, "verification:review") || can(actor, "report:review")) {
      widgets.push(
        db.trustSignal
          .aggregate({
            where: { status: "OPEN" },
            _count: { _all: true },
            _min: { createdAt: true },
          })
          .then((row) => ({
            key: "risk_signals_open",
            label: "Alertes de risque ouvertes",
            definition:
              "Alertes des règles déterministes non encore examinées. Indices, pas des preuves.",
            value: row._count._all,
            oldestAt: row._min.createdAt?.toISOString() ?? null,
            link: "/reports?tab=signals",
          })),
      )
    }
    if (can(actor, "user:read")) {
      widgets.push(
        db.user
          .aggregate({
            where: { status: { in: ["SUSPENDED", "BANNED"] }, deletedAt: null },
            _count: { _all: true },
            _min: { updatedAt: true },
          })
          .then((row) => ({
            key: "users_blocked",
            label: "Comptes suspendus ou bannis",
            definition: "Comptes au statut SUSPENDED ou BANNED.",
            value: row._count._all,
            oldestAt: row._min.updatedAt?.toISOString() ?? null,
            link: "/users?status=SUSPENDED",
          })),
      )
      const since = new Date(Date.now() - 7 * DAY_MS)
      widgets.push(
        db.user
          .aggregate({
            where: { createdAt: { gte: since }, deletedAt: null },
            _count: { _all: true },
            _min: { createdAt: true },
          })
          .then((row) => ({
            key: "users_new_7d",
            label: "Nouveaux comptes (7 jours)",
            definition:
              "Comptes créés au cours des 7 derniers jours glissants, hors comptes supprimés.",
            value: row._count._all,
            oldestAt: row._min.createdAt?.toISOString() ?? null,
            link: "/users",
          })),
      )
    }

    return {
      computedAt: new Date().toISOString(),
      queues: await Promise.all(widgets),
      analyticsAvailable: can(actor, "analytics:admin"),
    }
  }

  /** Identité et droits effectifs (relus en base) pour construire l'interface. */
  async me(actor: Actor) {
    const user = await this.db.client.user.findUnique({
      where: { id: actor.userId },
      select: { firstName: true, lastName: true },
    })
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    return {
      id: actor.publicId,
      name: name || null,
      roles: [...actor.roles].sort(),
      permissions: actor.roles.includes("SUPER_ADMIN")
        ? ["*"]
        : [...actor.permissions].sort(),
      manageableRoles: manageableRoles(actor),
    }
  }

  /** Matrice rôles → permissions, lecture seule. */
  async roles(): Promise<
    Array<{
      code: Role
      name: string
      description: string | null
      permissions: string[]
    }>
  > {
    const rows = await this.db.client.role.findMany({
      orderBy: { id: "asc" },
      select: {
        code: true,
        name: true,
        description: true,
        permissions: {
          select: { permission: { select: { code: true } } },
          orderBy: { permission: { code: "asc" } },
        },
      },
    })
    return rows.map((row) => ({
      code: row.code as Role,
      name: row.name,
      description: row.description,
      permissions: row.permissions.map((entry) => entry.permission.code),
    }))
  }
}
