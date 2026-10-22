import { Injectable } from "@nestjs/common"
import type { Role } from "@mon-appart/types"

import { IdentityDatabase, type Db } from "../persistence/identity-database"

const CACHE_TTL_MS = 60_000

/**
 * Rôles et permissions. La matrice rôle → permissions change rarement : elle
 * est gardée en mémoire 60 s pour éviter une requête par appel protégé.
 */
@Injectable()
export class RbacRepository {
  private cache: {
    expiresAt: number
    matrix: Map<string, Set<string>>
  } | null = null

  constructor(private readonly db: IdentityDatabase) {}

  async roleId(code: Role, db: Db = this.db.client): Promise<number | null> {
    const role = await db.role.findUnique({
      where: { code },
      select: { id: true },
    })
    return role?.id ?? null
  }

  async permissionsFor(roles: readonly Role[]): Promise<Set<string>> {
    const matrix = await this.matrix()
    const permissions = new Set<string>()
    for (const role of roles) {
      for (const permission of matrix.get(role) ?? [])
        permissions.add(permission)
    }
    return permissions
  }

  invalidate(): void {
    this.cache = null
  }

  private async matrix(): Promise<Map<string, Set<string>>> {
    if (this.cache && this.cache.expiresAt > Date.now())
      return this.cache.matrix
    const rows = await this.db.client.rolePermission.findMany({
      select: {
        role: { select: { code: true } },
        permission: { select: { code: true } },
      },
    })
    const matrix = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = matrix.get(row.role.code) ?? new Set<string>()
      set.add(row.permission.code)
      matrix.set(row.role.code, set)
    }
    this.cache = { expiresAt: Date.now() + CACHE_TTL_MS, matrix }
    return matrix
  }
}
