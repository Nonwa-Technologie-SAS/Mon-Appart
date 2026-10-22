import { afterEach, describe, expect, it, vi } from "vitest"

import type { CacheService } from "../../../common/cache/cache.service"
import { RecommendationInvalidationListener } from "../application/recommendation-invalidation.listener"
import type { RecommendationConfig } from "../recommendation.config"
import { RecommendationCache, type RankedList } from "./recommendation-cache"

class MemoryCache {
  readonly store = new Map<string, string>()
  async get(key: string) {
    return this.store.get(key) ?? null
  }
  async set(key: string, value: string) {
    this.store.set(key, value)
  }
  async del(key: string) {
    this.store.delete(key)
  }
  async incr(key: string) {
    const next = Number(this.store.get(key) ?? 0) + 1
    this.store.set(key, String(next))
    return next
  }
}

const config = (ttl = 300) =>
  ({
    cacheTtlSeconds: ttl,
    behavior: { profileMaxAgeMinutes: 60 },
  }) as unknown as RecommendationConfig

const LIST: RankedList = {
  asOf: "2026-10-09T12:00:00.000Z",
  algorithmVersion: "rules-v1",
  level: "PREFERENCES",
  degraded: false,
  items: [],
}

function setup(ttl?: number) {
  const memory = new MemoryCache()
  const cache = new RecommendationCache(
    memory as unknown as CacheService,
    config(ttl),
  )
  return { memory, cache }
}

describe("RecommendationCache", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("range chaque utilisateur sous sa propre clé, jamais sous celle des visiteurs", async () => {
    const { cache } = setup()
    const alice = await cache.listKey("PERSONALIZED", "alice", "h")
    const bob = await cache.listKey("PERSONALIZED", "bob", "h")
    const guest = await cache.listKey("PERSONALIZED", null, "h")
    expect(new Set([alice, bob, guest]).size).toBe(3)
    expect(alice).toContain("u:alice")
    expect(guest).toContain(":guest:")
    expect(await cache.listKey("SIMILAR", "alice", "h")).not.toBe(alice)
    expect(await cache.listKey("PERSONALIZED", "alice", "h2")).not.toBe(alice)

    await cache.set(alice, LIST)
    expect(await cache.get(alice)).toEqual(LIST)
    expect(await cache.get(bob)).toBeNull()
  })

  it("invalide les listes d'un utilisateur sans toucher aux autres", async () => {
    const { cache } = setup()
    const alice = await cache.listKey("PERSONALIZED", "alice", "h")
    const bob = await cache.listKey("PERSONALIZED", "bob", "h")
    await cache.bumpUser("alice")
    expect(await cache.listKey("PERSONALIZED", "alice", "h")).not.toBe(alice)
    expect(await cache.listKey("PERSONALIZED", "bob", "h")).toBe(bob)
  })

  it("invalide toutes les listes quand le catalogue change", async () => {
    const { cache } = setup()
    const before = await Promise.all([
      cache.listKey("PERSONALIZED", "alice", "h"),
      cache.listKey("SIMILAR", null, "h"),
    ])
    await cache.bumpGeneration()
    const after = await Promise.all([
      cache.listKey("PERSONALIZED", "alice", "h"),
      cache.listKey("SIMILAR", null, "h"),
    ])
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).not.toBe(before[1])
  })

  it("ne lit ni n'écrit rien avec un TTL nul", async () => {
    const { cache, memory } = setup(0)
    await cache.set("k", LIST)
    expect(memory.store.size).toBe(0)
    expect(await cache.get("k")).toBeNull()
  })

  it("ignore une entrée illisible", async () => {
    const { cache, memory } = setup()
    memory.store.set("k", "{oops")
    expect(await cache.get("k")).toBeNull()
  })

  it("marque puis efface un profil à recalculer", async () => {
    const { cache } = setup()
    expect(await cache.isProfileDirty("alice")).toBe(false)
    await cache.markProfileDirty("alice")
    expect(await cache.isProfileDirty("alice")).toBe(true)
    expect(await cache.isProfileDirty("bob")).toBe(false)
    await cache.clearProfileDirty("alice")
    expect(await cache.isProfileDirty("alice")).toBe(false)
  })

  it("regroupe une rafale d'événements catalogue en une invalidation", async () => {
    vi.useFakeTimers()
    const { cache, memory } = setup()
    const listener = new RecommendationInvalidationListener(cache)
    for (let i = 0; i < 25; i += 1) listener.onCatalogChange()
    expect(memory.store.get("rec:gen")).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(memory.store.get("rec:gen")).toBe("1")
    listener.onCatalogChange()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(memory.store.get("rec:gen")).toBe("2")
    listener.onModuleDestroy()
  })
})
