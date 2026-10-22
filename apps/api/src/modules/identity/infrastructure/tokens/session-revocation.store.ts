import { Injectable, Logger } from "@nestjs/common"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import { RedisService } from "../../../../redis/redis.service"
import { IdentityConfig } from "../../identity.config"

const PREFIX = "mon-appart:auth:revoked-session:"

/**
 * Liste de révocation des sessions pour les access tokens encore valides.
 * Une entrée vit le temps d'un access token : au-delà, le JWT est expiré.
 * Sans Redis, repli mémoire limité au processus courant (voir docs/identity.md).
 */
@Injectable()
export class SessionRevocationStore {
  private readonly logger = new Logger(SessionRevocationStore.name)
  private readonly memory = new Map<string, number>()

  constructor(
    private readonly redis: RedisService,
    private readonly config: IdentityConfig,
  ) {}

  async revoke(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return
    const ttl = this.config.accessTokenTtlMs + 5_000
    const expiresAt = Date.now() + ttl
    for (const id of sessionIds) this.memory.set(id, expiresAt)

    const client = this.redis.getClient()
    if (!client) return
    try {
      const pipeline = client.pipeline()
      for (const id of sessionIds) pipeline.set(PREFIX + id, "1", "PX", ttl)
      await pipeline.exec()
    } catch (error) {
      this.logger.warn(
        `Révocation Redis impossible : ${safeErrorMessage(error)}`,
      )
    }
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    const local = this.memory.get(sessionId)
    if (local !== undefined) {
      if (local > Date.now()) return true
      this.memory.delete(sessionId)
    }
    const client = this.redis.getClient()
    if (!client) return false
    try {
      return (await client.exists(PREFIX + sessionId)) === 1
    } catch (error) {
      this.logger.warn(
        `Lecture de révocation impossible : ${safeErrorMessage(error)}`,
      )
      return false
    }
  }
}
