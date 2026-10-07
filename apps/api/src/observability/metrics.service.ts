import { Injectable, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { collectDefaultMetrics, Histogram, Registry } from "prom-client"

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry()
  readonly httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Durée des requêtes HTTP",
    labelNames: ["method", "route", "status"],
    registers: [this.registry],
  })

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!this.isEnabled()) return
    collectDefaultMetrics({ register: this.registry })
  }

  isEnabled(): boolean {
    return this.config.get<string>("METRICS_ENABLED") === "true"
  }
}
