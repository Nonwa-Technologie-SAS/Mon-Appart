import { Module } from "@nestjs/common"

import { CommunicationModule } from "../communication/communication.module"
import { IdentityModule } from "../identity/identity.module"
import { ListingModule } from "../listing/listing.module"
import { AdminActivity } from "./application/admin-activity"
import { AdminAuditService } from "./application/admin-audit.service"
import { AdminDashboardService } from "./application/admin-dashboard.service"
import { AdminListingService } from "./application/admin-listing.service"
import { AdminNoteService } from "./application/admin-note.service"
import { AdminOutboxService } from "./application/admin-outbox.service"
import { AdminUserService } from "./application/admin-user.service"
import { ModerationReasonService } from "./application/moderation-reason.service"
import { AdminAccessGuard } from "./presentation/admin-access.guard"
import { AdminListingController } from "./presentation/admin-listing.controller"
import { AdminOutboxController } from "./presentation/admin-outbox.controller"
import { AdminUserController } from "./presentation/admin-user.controller"
import { AdminController } from "./presentation/admin.controller"

/**
 * Back-office : orchestre les modules métier sans les contourner. Comptes et
 * rôles passent par Identity, décisions sur annonces par la machine à états
 * de Listing, vérifications et signalements restent sous `/admin/trust`,
 * indicateurs sous `/admin/analytics`.
 */
@Module({
  imports: [IdentityModule, ListingModule, CommunicationModule],
  controllers: [
    AdminController,
    AdminUserController,
    AdminListingController,
    AdminOutboxController,
  ],
  providers: [
    AdminAccessGuard,
    AdminActivity,
    AdminAuditService,
    AdminNoteService,
    ModerationReasonService,
    AdminDashboardService,
    AdminUserService,
    AdminListingService,
    AdminOutboxService,
  ],
})
export class AdminModule {}
