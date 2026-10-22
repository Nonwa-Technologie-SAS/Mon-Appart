import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { PropertyAccessService } from "./application/property-access.service"
import { PropertyActivity } from "./application/property-activity"
import { PropertyQueryService } from "./application/property-query.service"
import { PropertyService } from "./application/property.service"
import { CatalogRepository } from "./infrastructure/catalog.repository"
import { PropertyRepository } from "./infrastructure/property.repository"
import { CatalogController } from "./presentation/catalog.controller"
import { PropertyController } from "./presentation/property.controller"

/**
 * Bien immobilier physique, ses équipements et ses rattachements.
 * Ne porte pas de prix ni de type d'offre : cela appartient au listing.
 */
@Module({
  imports: [IdentityModule],
  controllers: [PropertyController, CatalogController],
  providers: [
    CatalogRepository,
    PropertyRepository,
    PropertyAccessService,
    PropertyActivity,
    PropertyService,
    PropertyQueryService,
  ],
  exports: [PropertyAccessService, CatalogRepository],
})
export class PropertyModule {}
