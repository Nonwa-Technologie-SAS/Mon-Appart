import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

/**
 * Point d'extension OpenTelemetry et Sentry.
 * Les SDK ne sont pas chargés tant que l'observabilité n'est pas activée
 * explicitement, pour garder le développement local léger.
 */
@Injectable()
export class ObservabilityService implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityService.name)

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (this.config.get<string>("OTEL_ENABLED") === "true") {
      this.logger.warn(
        "OTEL_ENABLED=true : le SDK OpenTelemetry sera branché dans une étape suivante",
      )
    }
    const dsn = this.config.get<string>("SENTRY_DSN")
    if (dsn) {
      this.logger.warn(
        "SENTRY_DSN est défini : le SDK Sentry sera branché dans une étape suivante",
      )
    }
  }

  captureException(error: unknown): void {
    const name = error instanceof Error ? error.name : "Error"
    this.logger.error(name)
  }
}
