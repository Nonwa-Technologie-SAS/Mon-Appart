import { Injectable } from "@nestjs/common"

import type { Actor } from "../../identity"
import { billingError } from "../domain/billing-errors"
import { BillingRepository, isUuid } from "../infrastructure/billing.repository"
import type { MockOutcome } from "../infrastructure/providers/mock-payment.provider"
import { PaymentProviderRegistry } from "../infrastructure/providers/payment-provider.registry"
import { PaymentService, type PaymentView } from "./payment.service"
import { WebhookService } from "./webhook.service"

/**
 * Page de paiement simulée (développement et tests) : joue le rôle du payeur
 * chez le prestataire. Le résultat passe par le webhook signé, exactement
 * comme une notification externe ; rien n'est écrit directement. Absent
 * (404) dès que le simulateur n'est pas le prestataire actif.
 */
@Injectable()
export class MockCheckoutService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly webhooks: WebhookService,
    private readonly payments: PaymentService,
  ) {}

  async simulate(
    actor: Actor,
    paymentPublicId: string,
    outcome: MockOutcome,
  ): Promise<PaymentView> {
    const mock = this.providers.mock()
    if (!mock) throw billingError("PROVIDER_NOT_FOUND")
    const payment = isUuid(paymentPublicId)
      ? await this.repo.client.paymentTransaction.findUnique({
          where: { publicId: paymentPublicId },
          select: {
            provider: true,
            status: true,
            providerReference: true,
            order: { select: { buyerId: true } },
          },
        })
      : null
    if (
      !payment ||
      payment.order.buyerId !== actor.userId ||
      payment.provider !== mock.code ||
      !payment.providerReference
    ) {
      throw billingError("PAYMENT_NOT_FOUND")
    }
    const event = mock.simulate(payment.providerReference, outcome)
    if (!event) throw billingError("PAYMENT_NOT_FOUND")
    await this.webhooks.handle(
      mock.code,
      event.headers,
      Buffer.from(event.body),
    )
    return this.payments.getOwn(actor, paymentPublicId)
  }
}
