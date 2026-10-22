import { Module } from "@nestjs/common"

import { AdminAccessGuard } from "../admin/presentation/admin-access.guard"
import { IdentityModule } from "../identity"
import { PartnerDeliveryRunner } from "./application/partner-delivery-runner"
import { PartnerDeliveryService } from "./application/partner-delivery.service"
import { PartnerImportService } from "./application/partner-import.service"
import { PartnerRegistryService } from "./application/partner-registry.service"
import { PartnersRepository } from "./infrastructure/partners.repository"
import { PartnerAdminController } from "./presentation/partner-admin.controller"
import { PartnersConfig } from "./partners.config"

@Module({
  imports: [IdentityModule],
  controllers: [PartnerAdminController],
  providers: [
    AdminAccessGuard,
    PartnersConfig,
    PartnersRepository,
    PartnerRegistryService,
    PartnerImportService,
    PartnerDeliveryService,
    PartnerDeliveryRunner,
  ],
  exports: [PartnerRegistryService, PartnersRepository],
})
export class PartnersModule {}
