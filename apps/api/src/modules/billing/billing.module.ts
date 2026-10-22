import { Module } from "@nestjs/common"

import { AdminAccessGuard } from "../admin/presentation/admin-access.guard"
import { CommunicationModule } from "../communication/communication.module"
import { IdentityModule } from "../identity/identity.module"
import { BillingActivity } from "./application/billing-activity"
import { BillingAdminService } from "./application/billing-admin.service"
import { CatalogService } from "./application/catalog.service"
import { FulfillmentService } from "./application/fulfillment.service"
import { MockCheckoutService } from "./application/mock-checkout.service"
import { OrderService } from "./application/order.service"
import { PaymentService } from "./application/payment.service"
import { ReconciliationService } from "./application/reconciliation.service"
import { RefundService } from "./application/refund.service"
import { SubscriptionService } from "./application/subscription.service"
import { WebhookService } from "./application/webhook.service"
import { BillingConfig } from "./billing.config"
import { BillingRepository } from "./infrastructure/billing.repository"
import { PaymentProviderRegistry } from "./infrastructure/providers/payment-provider.registry"
import { BillingAdminController } from "./presentation/billing-admin.controller"
import { BillingWebhookController } from "./presentation/billing-webhook.controller"
import { BillingController } from "./presentation/billing.controller"

/**
 * Monétisation des services de la plateforme (abonnements). N'encaisse
 * jamais loyers, cautions ni prix de vente. PostgreSQL fait foi ; les
 * prestataires sont derrière `PaymentProvider` (simulateur seulement à ce
 * stade).
 */
@Module({
  imports: [IdentityModule, CommunicationModule],
  controllers: [
    BillingController,
    BillingWebhookController,
    BillingAdminController,
  ],
  providers: [
    AdminAccessGuard,
    BillingConfig,
    BillingRepository,
    PaymentProviderRegistry,
    BillingActivity,
    CatalogService,
    FulfillmentService,
    OrderService,
    PaymentService,
    RefundService,
    SubscriptionService,
    WebhookService,
    MockCheckoutService,
    ReconciliationService,
    BillingAdminService,
  ],
  exports: [PaymentProviderRegistry, ReconciliationService],
})
export class BillingModule {}
