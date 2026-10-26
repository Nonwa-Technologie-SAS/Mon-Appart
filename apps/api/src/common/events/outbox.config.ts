import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class OutboxConfig {
  readonly worker: {
    enabled: boolean
    pollMs: number
    batchSize: number
    maxAttempts: number
    retryBaseSeconds: number
    /** Rétention des événements publiés (jours). 0 = pas de purge automatique. */
    retentionDays: number
  }

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    const flag = (key: string, fallback: boolean) => {
      const value = config.get<string>(key)
      return value === undefined ? fallback : value === "true"
    }

    this.worker = {
      enabled: flag("OUTBOX_WORKER_ENABLED", true),
      pollMs: num("OUTBOX_WORKER_POLL_MS", 2_000),
      batchSize: num("OUTBOX_WORKER_BATCH_SIZE", 50),
      maxAttempts: num("OUTBOX_MAX_ATTEMPTS", 8),
      retryBaseSeconds: num("OUTBOX_RETRY_BASE_SECONDS", 5),
      retentionDays: num("OUTBOX_RETENTION_DAYS", 14),
    }
  }
}
