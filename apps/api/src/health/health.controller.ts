import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import type { Response } from "express"

import { Public } from "../modules/identity"
import { HealthService } from "./health.service"

@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle()
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async summary(@Res({ passthrough: true }) response: Response) {
    const report = await this.health.report()
    response.status(report.status === "ok" ? 200 : 503)
    return report
  }

  @Get("live")
  live() {
    return this.health.live()
  }

  @Get("ready")
  async ready(@Res({ passthrough: true }) response: Response) {
    const report = await this.health.report()
    response.status(report.status === "ok" ? 200 : 503)
    return report
  }
}
