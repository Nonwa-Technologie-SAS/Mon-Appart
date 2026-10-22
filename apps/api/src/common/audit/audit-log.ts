import { toInet, truncate, type Db } from "../../database/database.service"
import type { Prisma } from "../../generated/prisma/client"

export interface AuditEntry {
  action: string
  actorId: bigint | null
  entityType: string
  entityId: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

/** Écrit une ligne de journal d'audit. `entityId` est un identifiant public. */
export async function insertAuditLog(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId.slice(0, 64),
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      ipAddress: toInet(entry.ipAddress),
      userAgent: truncate(entry.userAgent, 512),
      requestId: truncate(entry.requestId, 128),
    },
  })
}
