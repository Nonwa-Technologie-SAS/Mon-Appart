import { CacheService } from "./cache.service"
import type { RedisService } from "../../redis/redis.service"

describe("CacheService", () => {
  it("retourne null quand Redis est indisponible", async () => {
    const redis = {
      getClient: () => null,
    } as unknown as RedisService
    const cache = new CacheService(redis)
    await expect(cache.get("session:1")).resolves.toBeNull()
    await expect(cache.acquireLock("otp:1", 30)).resolves.toBeNull()
  })
})
