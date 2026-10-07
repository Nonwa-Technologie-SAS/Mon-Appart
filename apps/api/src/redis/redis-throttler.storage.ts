import { Injectable } from "@nestjs/common"
import type { ThrottlerStorage } from "@nestjs/throttler"

import { RedisService } from "./redis.service"

interface MemoryHit {
  count: number
  expiresAt: number
}

/**
 * Compteur Redis, avec repli mémoire si Redis est indisponible.
 * Le repli ne couvre qu'un seul processus : le rate limiting multi-instances
 * exige Redis.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memory = new Map<string, MemoryHit>()

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const storageKey = `mon-appart:throttle:${throttlerName}:${key}`
    const client = this.redis.getClient()
    if (!client) return this.incrementMemory(storageKey, ttl, limit, blockDuration)

    try {
      const hits = await client.incr(storageKey)
      if (hits === 1) {
        await client.pexpire(storageKey, ttl)
      }
      const remaining = await client.pttl(storageKey)
      const timeToExpire = Math.max(1, Math.ceil(remaining / 1000))
      const isBlocked = hits > limit
      return {
        totalHits: hits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
      }
    } catch {
      return this.incrementMemory(storageKey, ttl, limit, blockDuration)
    }
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ) {
    const now = Date.now()
    const current = this.memory.get(key)
    if (!current || current.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + ttl })
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      }
    }

    current.count += 1
    const isBlocked = current.count > limit
    return {
      totalHits: current.count,
      timeToExpire: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    }
  }
}
