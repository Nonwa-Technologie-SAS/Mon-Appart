import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import { adminError } from "../domain/admin-errors"
import { redactAuditValues } from "../domain/admin-policy"

export interface AuditQuery {
  entityType?: string
  entityId?: string
  action?: string
  actorId?: string
  from?: Date
  to?: Date
  cursor?: string
  limit?: number
}

export interface AuditEntryView {
  at: string
  action: string
  actor: { id: string; name: string | null } | null
  entityType: string
  entityId: string
  oldValues: unknown
  newValues: unknown
  ipAddress: string | null
  requestId: string | null
}

interface AuditRow {
  created_at: Date
  boundary: string
  action: string
  entity_type: string
  entity_id: string
  old_values: unknown
  new_values: unknown
  ip_address: string | null
  request_id: string | null
  actor_public_id: string | null
  actor_first_name: string | null
  actor_last_name: string | null
}

/** Marge au-delà de la page pour inclure les lignes d'un même horodatage. */
const TIE_MARGIN = 100
const CURSOR = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?\+00$/

/**
 * Lecture seule du journal d'audit (la table refuse toute mise à jour). La
 * pagination s'appuie sur l'horodatage à la microseconde, sans exposer
 * d'identifiant interne : une page inclut toutes les lignes de son dernier
 * horodatage (écritures d'une même transaction).
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    query: AuditQuery,
  ): Promise<{ items: AuditEntryView[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100)
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`]
    if (query.entityType) {
      conditions.push(Prisma.sql`a.entity_type = ${query.entityType}`)
    }
    if (query.entityId) {
      conditions.push(Prisma.sql`a.entity_id = ${query.entityId}`)
    }
    if (query.action) conditions.push(Prisma.sql`a.action = ${query.action}`)
    if (query.actorId) {
      conditions.push(
        Prisma.sql`a.actor_id = (SELECT id FROM users WHERE public_id = ${query.actorId}::uuid)`,
      )
    }
    if (query.from) conditions.push(Prisma.sql`a.created_at >= ${query.from}`)
    if (query.to) conditions.push(Prisma.sql`a.created_at < ${query.to}`)
    if (query.cursor) {
      if (!CURSOR.test(query.cursor)) throw adminError("ADMIN_CURSOR_INVALID")
      conditions.push(Prisma.sql`a.created_at < ${query.cursor}::timestamptz`)
    }
    const where = Prisma.join(conditions, " AND ")

    const rows = await this.db.client.$queryRaw<AuditRow[]>`
      WITH page AS (
        SELECT a.created_at FROM audit_logs a
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      )
      SELECT
        a.created_at,
        to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00' AS boundary,
        a.action, a.entity_type, a.entity_id, a.old_values, a.new_values,
        host(a.ip_address) AS ip_address, a.request_id,
        u.public_id::text AS actor_public_id,
        u.first_name AS actor_first_name, u.last_name AS actor_last_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE ${where}
        AND a.created_at >= (SELECT min(created_at) FROM page)
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limit + TIE_MARGIN}
    `
    if (rows.length === 0) return { items: [], nextCursor: null }
    const boundary = rows[rows.length - 1]!.boundary
    const more = await this.db.client.$queryRaw<Array<{ more: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM audit_logs a
        WHERE ${where} AND a.created_at < ${boundary}::timestamptz
      ) AS more
    `
    return {
      items: rows.map(toView),
      nextCursor: more[0]?.more ? boundary : null,
    }
  }

  async forEntity(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<AuditEntryView[]> {
    const page = await this.list({ entityType, entityId, limit })
    return page.items
  }
}

function toView(row: AuditRow): AuditEntryView {
  const name = [row.actor_first_name, row.actor_last_name]
    .filter(Boolean)
    .join(" ")
  return {
    at: row.created_at.toISOString(),
    action: row.action,
    actor: row.actor_public_id
      ? { id: row.actor_public_id, name: name || null }
      : null,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValues: redactAuditValues(row.old_values),
    newValues: redactAuditValues(row.new_values),
    ipAddress: row.ip_address,
    requestId: row.request_id,
  }
}
