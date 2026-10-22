import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common"

import { IdentityConfig } from "../../identity.config"
import { IdentityRetentionService } from "./identity-retention.service"

/** Tâche périodique optionnelle ; intervalle 0 = désactivée. */
@Injectable()
export class IdentityRetentionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdentityRetentionWorker.name)
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(
    private readonly retention: IdentityRetentionService,
    private readonly config: IdentityConfig,
  ) {}

  onModuleInit(): void {
    if (this.config.retentionIntervalMs <= 0) return
    this.timer = setInterval(() => {
      void this.tick()
    }, this.config.retentionIntervalMs)
    this.timer.unref?.()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      await this.retention.purge()
    } catch (error: unknown) {
      this.logger.warn({
        msg: "identity.retention.failed",
        error: error instanceof Error ? error.message : "unknown",
      })
    } finally {
      this.running = false
    }
  }
}
