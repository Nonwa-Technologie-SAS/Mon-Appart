import { Global, Module } from "@nestjs/common"

import { MetricsController } from "./metrics.controller"
import { MetricsService } from "./metrics.service"
import { ObservabilityService } from "./observability.service"

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, ObservabilityService],
  exports: [MetricsService, ObservabilityService],
})
export class ObservabilityModule {}
