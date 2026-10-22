import { Injectable, Logger } from "@nestjs/common"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import { RedisService } from "../../../../redis/redis.service"

const PREFIX = "mon-appart:auth:"

export interface RateLimitResult {
  allowed: boolean
  count: number
  retryAfterSeconds: number
}

/**
 * Compteurs à fenêtre fixe et délais d'attente, dans Redis avec repli mémoire
 * (un seul processus). Les clés reçues sont déjà des empreintes : aucun email,
 * téléphone ni IP en clair dans Redis.
 */
@Injectable()
export class AuthRateLimiter {
  private readonly logger = new Logger(AuthRateLimiter.name)
  private readonly memory = new Map<
    string,
    { count: number; expiresAt: number }
  >()

  constructor(private readonly redis: RedisService) {}

  /** Incrémente puis indique si la limite est dépassée. */
  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const storageKey = PREFIX + key
    const client = this.redis.getClient()
    if (client) {
      try {
        const results = await client
          .multi()
          .incr(storageKey)
          .expire(storageKey, windowSeconds, "NX")
          .ttl(storageKey)
          .exec()
        const count = Number(results?.[0]?.[1] ?? 0)
        const ttl = Number(results?.[2]?.[1] ?? windowSeconds)
        return {
          allowed: count <= limit,
          count,
          retryAfterSeconds: Math.max(1, ttl),
        }
      } catch (error) {
        this.logger.warn(
          `Rate limit Redis indisponible : ${safeErrorMessage(error)}`,
        )
      }
    }
    return this.hitMemory(storageKey, limit, windowSeconds)
  }

  /** Lit le compteur sans l'incrémenter. */
  async peek(
    key: string,
  ): Promise<{ count: number; retryAfterSeconds: number }> {
    const storageKey = PREFIX + key
    const client = this.redis.getClient()
    if (client) {
      try {
        const [count, ttl] = await Promise.all([
          client.get(storageKey),
          client.ttl(storageKey),
        ])
        return {
          count: Number(count ?? 0),
          retryAfterSeconds: Math.max(1, ttl),
        }
      } catch (error) {
        this.logger.warn(
          `Rate limit Redis indisponible : ${safeErrorMessage(error)}`,
        )
      }
    }
    const entry = this.memory.get(storageKey)
    if (!entry || entry.expiresAt <= Date.now())
      return { count: 0, retryAfterSeconds: 0 }
    return {
      count: entry.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.expiresAt - Date.now()) / 1000),
      ),
    }
  }

  async reset(key: string): Promise<void> {
    const storageKey = PREFIX + key
    this.memory.delete(storageKey)
    const client = this.redis.getClient()
    if (!client) return
    try {
      await client.del(storageKey)
    } catch (error) {
      this.logger.warn(
        `Rate limit Redis indisponible : ${safeErrorMessage(error)}`,
      )
    }
  }

  /** Pose un verrou temporaire ; `acquired=false` si un verrou est déjà actif. */
  async acquireCooldown(
    key: string,
    seconds: number,
  ): Promise<{ acquired: boolean; retryAfterSeconds: number }> {
    if (seconds <= 0) return { acquired: true, retryAfterSeconds: 0 }
    const result = await this.hit(`cooldown:${key}`, 1, seconds)
    return {
      acquired: result.allowed,
      retryAfterSeconds: result.retryAfterSeconds,
    }
  }

  private hitMemory(
    key: string,
    limit: number,
    windowSeconds: number,
  ): RateLimitResult {
    const now = Date.now()
    const current = this.memory.get(key)
    if (!current || current.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 })
      return { allowed: 1 <= limit, count: 1, retryAfterSeconds: windowSeconds }
    }
    current.count += 1
    return {
      allowed: current.count <= limit,
      count: current.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.expiresAt - now) / 1000),
      ),
    }
  }
}
