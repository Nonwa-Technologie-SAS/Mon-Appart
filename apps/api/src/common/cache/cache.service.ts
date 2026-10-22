import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { RedisService } from "../../redis/redis.service"

const PREFIX = "mon-appart:"

/**
 * Cache et verrous. Redis n'est pas la source de vérité :
 * un échec de lecture est traité comme un miss.
 */
@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get(key: string): Promise<string | null> {
    const client = this.redis.getClient()
    if (!client) return null
    try {
      return await client.get(PREFIX + key)
    } catch {
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.redis.getClient()
    if (!client) return
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(PREFIX + key, value, "EX", ttlSeconds)
        return
      }
      await client.set(PREFIX + key, value)
    } catch {
      return
    }
  }

  async del(key: string): Promise<void> {
    const client = this.redis.getClient()
    if (!client) return
    try {
      await client.del(PREFIX + key)
    } catch {
      return
    }
  }

  /** Compteur atomique ; `null` si Redis est absent ou en échec. */
  async incr(key: string): Promise<number | null> {
    const client = this.redis.getClient()
    if (!client) return null
    try {
      return await client.incr(PREFIX + key)
    } catch {
      return null
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const client = this.redis.getClient()
    if (!client) return null
    const token = randomUUID()
    try {
      const result = await client.set(
        `${PREFIX}lock:${key}`,
        token,
        "EX",
        ttlSeconds,
        "NX",
      )
      return result === "OK" ? token : null
    } catch {
      return null
    }
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const client = this.redis.getClient()
    if (!client) return false
    try {
      const released = await client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        `${PREFIX}lock:${key}`,
        token,
      )
      return released === 1
    } catch {
      return false
    }
  }
}
