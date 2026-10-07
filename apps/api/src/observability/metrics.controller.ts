import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import type { Response } from "express"

import { MetricsService } from "./metrics.service"

@Controller({ path: "metrics", version: VERSION_NEUTRAL })
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() response: Response): Promise<void> {
    if (!this.metrics.isEnabled()) {
      response.status(404).send()
      return
    }
    response.setHeader("Content-Type", this.metrics.registry.contentType)
    response.send(await this.metrics.registry.metrics())
  }
}
