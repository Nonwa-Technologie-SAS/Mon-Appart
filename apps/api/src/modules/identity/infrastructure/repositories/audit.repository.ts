import { Injectable } from "@nestjs/common"

import {
  insertAuditLog,
  type AuditEntry,
} from "../../../../common/audit/audit-log"
import { IdentityDatabase, type Db } from "../persistence/identity-database"

export type { AuditEntry }

@Injectable()
export class AuditRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async insert(entry: AuditEntry, db: Db = this.db.client): Promise<void> {
    await insertAuditLog(db, entry)
  }
}
