import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { PropertyModule } from "../property/property.module"
import { ListingActivity } from "./application/listing-activity"
import { ListingQueryService } from "./application/listing-query.service"
import { ListingService } from "./application/listing.service"
import { ListingRepository } from "./infrastructure/listing.repository"
import { ListingConfig } from "./listing.config"
import { ListingController } from "./presentation/listing.controller"

/**
 * Offre commerciale sur un bien : type, statut, prix historisé.
 * Un bien peut avoir plusieurs annonces dans le temps.
 */
@Module({
  imports: [IdentityModule, PropertyModule],
  controllers: [ListingController],
  providers: [
    ListingConfig,
    ListingRepository,
    ListingActivity,
    ListingService,
    ListingQueryService,
  ],
  exports: [ListingService],
})
export class ListingModule {}
