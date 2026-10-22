import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { parseSecretsKey } from "./domain/partner-secrets"

@Injectable()
export class PartnersConfig {
  readonly secretsKey: Buffer | null
  /** 0 = worker désactivé (traitement manuel / tests). */
  readonly workerIntervalMs: number
  readonly maxDeliveryAttempts: number
  readonly deliveryTimeoutMs: number

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    this.secretsKey = parseSecretsKey(
      config.get<string>("PARTNERS_SECRETS_KEY"),
    )
    this.workerIntervalMs = num("PARTNERS_WORKER_INTERVAL_SECONDS", 30) * 1_000
    this.maxDeliveryAttempts = 8
    this.deliveryTimeoutMs = 10_000
  }
}
