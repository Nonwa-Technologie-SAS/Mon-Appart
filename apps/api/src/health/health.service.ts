import { Injectable } from "@nestjs/common"
import type { DependencyCheck, HealthReport } from "@mon-appart/types"

import { PrismaService } from "../database/prisma.service"
import { RedisService } from "../redis/redis.service"

/** Timeout par dépendance health (évite un ready bloqué). */
const DEFAULT_CHECK_TIMEOUT_MS = 2_000

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  live(): { status: "ok"; service: "api"; version?: string } {
    const version =
      process.env.APP_VERSION?.trim() ||
      process.env.GIT_SHA?.trim() ||
      undefined
    return version
      ? { status: "ok", service: "api", version }
      : { status: "ok", service: "api" }
  }

  /**
   * Readiness : Postgres + PostGIS + Redis sont critiques pour l’API.
   * OpenSearch, IA, SMTP/SMS ne font pas partie de ce rapport
   * (voir `/health/search` et modes dégradés documentés).
   */
  async report(): Promise<HealthReport> {
    const timeoutMs = Number(
      process.env.HEALTH_CHECK_TIMEOUT_MS ?? DEFAULT_CHECK_TIMEOUT_MS,
    )
    const timedOut: DependencyCheck = { status: "down", detail: "timeout" }

    const [postgres, postgis, redisStatus] = await Promise.all([
      withTimeout(this.prisma.checkPostgres(), timeoutMs, timedOut),
      withTimeout(this.prisma.checkPostgis(), timeoutMs, timedOut),
      withTimeout(this.redisStatus(), timeoutMs, timedOut),
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

/** Race une promesse contre un délai ; utilisé uniquement pour les health checks. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: T,
): Promise<T> {
  if (!(ms > 0) || !Number.isFinite(ms)) return promise
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
