import { Injectable } from "@nestjs/common"

import { PrismaService } from "../../../../database/prisma.service"
import type { PrismaClient } from "../../../../generated/prisma/client"
import type { Tx } from "../../../../database/database.service"
import { authError, AuthErrorCode } from "../../domain/auth-errors"

export type { Db, Tx } from "../../../../database/database.service"
export {
  isUniqueViolation,
  toInet,
  truncate,
} from "../../../../database/database.service"

/** Accès PostgreSQL du module ; 503 explicite si la base n'est pas configurée. */
@Injectable()
export class IdentityDatabase {
  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaClient {
    const client = this.prisma.getClient()
    if (!client) throw authError(AuthErrorCode.IDENTITY_UNAVAILABLE)
    return client
  }

  transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.client.$transaction(run, {
      isolationLevel: "ReadCommitted",
      timeout: 10_000,
    })
  }
}
