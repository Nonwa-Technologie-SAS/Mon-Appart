import { Injectable } from "@nestjs/common"

import { BillingConfig } from "../../billing.config"
import { MockPaymentProvider } from "./mock-payment.provider"
import type { PaymentProvider } from "./payment-provider"

/**
 * Prestataire actif, choisi par `PAYMENT_PROVIDER`. Un seul à la fois ; un
 * code inconnu ou inactif est traité comme absent (404 sur les webhooks).
 * Aucun prestataire réel n'est implémenté à ce stade.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly provider: PaymentProvider | null

  constructor(config: BillingConfig) {
    if (config.provider === "mock" && config.mockWebhookSecret) {
      this.provider = new MockPaymentProvider(
        config.mockWebhookSecret,
        config.webhookToleranceSeconds,
      )
    } else {
      this.provider = null
    }
  }

  active(): PaymentProvider | null {
    return this.provider
  }

  byCode(code: string): PaymentProvider | null {
    return this.provider && this.provider.code === code ? this.provider : null
  }

  /** Simulateur actif, sinon `null` (routes de simulation désactivées). */
  mock(): MockPaymentProvider | null {
    return this.provider instanceof MockPaymentProvider ? this.provider : null
  }
}
