import { Module } from "@nestjs/common"

import { AdminAccessGuard } from "../admin/presentation/admin-access.guard"
import { IdentityModule } from "../identity"
import { PartnerDeliveryRunner } from "./application/partner-delivery-runner"
import { PartnerDeliveryService } from "./application/partner-delivery.service"
import { PartnerImportService } from "./application/partner-import.service"
import { PartnerRegistryService } from "./application/partner-registry.service"
import { SupplyLeadService } from "./application/supply-lead.service"
import { PartnersRepository } from "./infrastructure/partners.repository"
import { SupplyLeadsRepository } from "./infrastructure/supply-leads.repository"
import { PartnerAdminController } from "./presentation/partner-admin.controller"
import { SupplyLeadAdminController } from "./presentation/supply-lead-admin.controller"
import { PartnersConfig } from "./partners.config"

@Module({
  imports: [IdentityModule],
  controllers: [PartnerAdminController, SupplyLeadAdminController],
  providers: [
    AdminAccessGuard,
    PartnersConfig,
    PartnersRepository,
    SupplyLeadsRepository,
    PartnerRegistryService,
    PartnerImportService,
    PartnerDeliveryService,
    PartnerDeliveryRunner,
    SupplyLeadService,
  ],
  exports: [PartnerRegistryService, PartnersRepository, SupplyLeadService],
})
export class PartnersModule {}
