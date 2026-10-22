import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { InteractionService } from "./application/interaction.service"
import { InteractionRepository } from "./infrastructure/interaction.repository"
import { InteractionController } from "./presentation/interaction.controller"

/**
 * Favoris et consultations. Alimente les tables lues par Recommendation
 * (`favorites`, `property_views`) sans dupliquer le moteur de ranking.
 */
@Module({
  imports: [IdentityModule],
  controllers: [InteractionController],
  providers: [InteractionRepository, InteractionService],
  exports: [InteractionService],
})
export class InteractionModule {}
