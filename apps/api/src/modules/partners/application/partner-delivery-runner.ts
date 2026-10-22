import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { decryptSecret } from "../domain/partner-secrets"
import {
  PARTNER_SIGNATURE_HEADER,
  signPayload,
} from "../domain/partner-webhook"
import { PartnersConfig } from "../partners.config"
import { PartnersRepository } from "../infrastructure/partners.repository"

@Injectable()
export class PartnerDeliveryRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PartnerDeliveryRunner.name)
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null
  private stopping = false

  constructor(
    private readonly repository: PartnersRepository,
    private readonly config: PartnersConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.workerIntervalMs <= 0) return
    this.schedule(this.config.workerIntervalMs)
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true
    if (this.timer) clearTimeout(this.timer)
    await this.running?.catch(() => undefined)
  }

  async runOnce(maxJobs = 50): Promise<{ delivered: number; failed: number; retry: number }> {
    const counts = { delivered: 0, failed: 0, retry: 0 }
    if (!this.config.secretsKey) return counts

    const claimed = await this.repository.claimDueDeliveries(maxJobs)
    for (const row of claimed) {
      const integration = await this.repository.client.partnerIntegration.findUnique({
        where: { id: row.integration_id },
      })
      if (
        !integration ||
        integration.status !== "ACTIVE" ||
        !integration.webhookUrl ||
        !integration.webhookSecretCipher
      ) {
        await this.repository.markFailed(
          row.id,
          row.attempts + 1,
          "integration_inactive",
        )
        counts.failed += 1
        continue
      }

      let secret: string
      try {
        secret = decryptSecret(
          this.config.secretsKey,
          integration.webhookSecretCipher,
        )
      } catch {
        await this.repository.markFailed(
          row.id,
          row.attempts + 1,
          "secret_decrypt_failed",
        )
        counts.failed += 1
        continue
      }

      const body = Buffer.from(JSON.stringify(row.payload), "utf8")
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = signPayload(secret, body, timestamp)

      try {
        const controller = new AbortController()
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.deliveryTimeoutMs,
        )
        const response = await fetch(integration.webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [PARTNER_SIGNATURE_HEADER]: signature,
            "idempotency-key": row.event_id,
          },
          body,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (response.ok) {
          await this.repository.markDelivered(row.id)
          await this.repository.updateIntegration(integration.publicId, {
            lastCheckedAt: new Date(),
            lastError: null,
          })
          counts.delivered += 1
          continue
        }

        const attempts = row.attempts + 1
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempts < this.config.maxDeliveryAttempts) {
          const delayMs = Math.min(60_000 * 2 ** Math.min(attempts, 6), 3_600_000)
          await this.repository.markRetry(
            row.id,
            attempts,
            new Date(Date.now() + delayMs),
            `http_${response.status}`,
          )
          counts.retry += 1
        } else {
          await this.repository.markFailed(
            row.id,
            attempts,
            `http_${response.status}`,
          )
          await this.repository.updateIntegration(integration.publicId, {
            lastCheckedAt: new Date(),
            lastError: `http_${response.status}`.slice(0, 255),
          })
          counts.failed += 1
        }
      } catch (error) {
        const attempts = row.attempts + 1
        const label =
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "network_error"
        if (attempts < this.config.maxDeliveryAttempts) {
          const delayMs = Math.min(60_000 * 2 ** Math.min(attempts, 6), 3_600_000)
          await this.repository.markRetry(
            row.id,
            attempts,
            new Date(Date.now() + delayMs),
            label,
          )
          counts.retry += 1
        } else {
          await this.repository.markFailed(row.id, attempts, label)
          counts.failed += 1
        }
      }
    }
    return counts
  }

  private schedule(delayMs: number): void {
    if (this.stopping) return
    this.timer = setTimeout(() => {
      this.running = this.runOnce()
        .catch((error) => {
          this.logger.warn(
            JSON.stringify({
              event: "partner.worker_failed",
              message: error instanceof Error ? error.message : "unknown",
            }),
          )
        })
        .finally(() => {
          this.running = null
          this.schedule(this.config.workerIntervalMs)
        })
    }, delayMs)
  }
}
