import { Injectable } from "@nestjs/common"
import type { DependencyCheck, HealthReport } from "@mon-appart/types"

import { PrismaService } from "../database/prisma.service"
import { RedisService } from "../redis/redis.service"

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  live(): { status: "ok"; service: "api" } {
    return { status: "ok", service: "api" }
  }

  async report(): Promise<HealthReport> {
    const [postgres, postgis, redisStatus] = await Promise.all([
      this.prisma.checkPostgres(),
      this.prisma.checkPostgis(),
      this.redisStatus(),
    ])
    const checks = { postgres, postgis, redis: redisStatus }
    return aggregateHealth("api", checks)
  }

  private async redisStatus(): Promise<DependencyCheck> {
    if (!this.redis.isConfigured()) {
      return { status: "down", detail: "not_configured" }
    }
    const status = await this.redis.ping()
    return status === "up"
      ? { status: "up" }
      : { status: "down", detail: "unavailable" }
  }
}

export function aggregateHealth(
  service: string,
  checks: Record<string, DependencyCheck>,
): HealthReport {
  const ready = Object.values(checks).every((check) => check.status === "up")
  return {
    status: ready ? "ok" : "degraded",
    service,
    checks,
  }
}
