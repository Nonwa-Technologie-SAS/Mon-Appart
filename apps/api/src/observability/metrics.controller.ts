import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { SkipThrottle } from "@nestjs/throttler"
import type { Response } from "express"

import { bearerMatches } from "../common/security/bearer-token"
import { Public } from "../modules/identity"
import { MetricsService } from "./metrics.service"

/**
 * Exposition Prometheus. Public au sens JWT (pas de session utilisateur),
 * mais protégé par un jeton de scrape dédié lorsque les métriques sont actives.
 */
@Controller({ path: "metrics", version: VERSION_NEUTRAL })
@SkipThrottle()
@Public()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async scrape(
    @Headers("authorization") authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.metrics.isEnabled()) {
      response.status(404).send()
      return
    }
    const token = this.config.get<string>("METRICS_SCRAPE_TOKEN") ?? ""
    if (!bearerMatches(authorization, token)) {
      throw new UnauthorizedException("METRICS_UNAUTHORIZED")
    }
    response.setHeader("Content-Type", this.metrics.registry.contentType)
    response.send(await this.metrics.registry.metrics())
  }
}
