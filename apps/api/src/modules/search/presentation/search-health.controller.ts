import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common"
import { ApiExcludeController } from "@nestjs/swagger"
import { SkipThrottle } from "@nestjs/throttler"
import type { DependencyCheck, HealthReport } from "@mon-appart/types"
import type { Response } from "express"

import { Public } from "../../identity"
import { SearchEngineFactory } from "../infrastructure/search-engine.factory"
import { SearchConfig } from "../search.config"

/**
 * État de la recherche. 200 « ok » si le moteur configuré répond, 200
 * « degraded » si OpenSearch est en panne mais que le repli PostgreSQL
 * fonctionne, 503 si aucune recherche n'est possible.
 */
@ApiExcludeController()
@Controller({ path: "health/search", version: VERSION_NEUTRAL })
@SkipThrottle()
@Public()
export class SearchHealthController {
  constructor(
    private readonly engines: SearchEngineFactory,
    private readonly config: SearchConfig,
  ) {}

  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthReport> {
    const checks: Record<string, DependencyCheck> = {
      postgres_search: await this.engines.postgres.health(),
    }
    if (this.engines.opensearch) {
      checks.opensearch = await this.engines.opensearch.health()
    }
    const postgresUp = checks.postgres_search!.status === "up"
    const primaryUp =
      this.config.engine === "opensearch"
        ? checks.opensearch?.status === "up"
        : postgresUp
    const usable =
      primaryUp || (this.config.fallback === "postgres" && postgresUp)
    response.status(usable ? 200 : 503)
    return {
      status: primaryUp ? "ok" : "degraded",
      service: `search:${this.config.engine}`,
      checks,
    }
  }
}
