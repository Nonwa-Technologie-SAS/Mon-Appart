import { AnalyticsModule } from "./analytics/analytics.module"
import { CommunicationModule } from "./communication/communication.module"
import { IdentityModule } from "./identity/identity.module"
import { InteractionModule } from "./interaction/interaction.module"
import { ListingModule } from "./listing/listing.module"
import { LocationModule } from "./location/location.module"
import { MediaModule } from "./media/media.module"
import { PropertyModule } from "./property/property.module"
import { RecommendationModule } from "./recommendation/recommendation.module"
import { SearchModule } from "./search/search.module"
import { TransactionModule } from "./transaction/transaction.module"
import { TrustModule } from "./trust/trust.module"

export const domainModules = [
  IdentityModule,
  LocationModule,
  PropertyModule,
  ListingModule,
  MediaModule,
  SearchModule,
  InteractionModule,
  RecommendationModule,
  TrustModule,
  CommunicationModule,
  TransactionModule,
  AnalyticsModule,
]
