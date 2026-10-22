import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { MediaModule } from "../media/media.module"
import { AppointmentReminders } from "./appointments/application/appointment-reminders"
import { AppointmentService } from "./appointments/application/appointment.service"
import { AppointmentController } from "./appointments/presentation/appointment.controller"
import { CommunicationActivity } from "./communication-activity"
import { CommunicationConfig } from "./communication.config"
import { ConversationAccessService } from "./messaging/application/conversation-access.service"
import { ConversationModerationService } from "./messaging/application/conversation-moderation.service"
import { ConversationService } from "./messaging/application/conversation.service"
import { MessageService } from "./messaging/application/message.service"
import { ConversationRepository } from "./messaging/infrastructure/conversation.repository"
import { ConversationController } from "./messaging/presentation/conversation.controller"
import { DeliveryRunner } from "./notifications/application/delivery-runner"
import { NotificationDispatcher } from "./notifications/application/notification-dispatcher"
import { NotificationService } from "./notifications/application/notification.service"
import { PreferenceService } from "./notifications/application/preference.service"
import { PushDeviceService } from "./notifications/application/push-device.service"
import { DeliveryRepository } from "./notifications/infrastructure/delivery.repository"
import { channelProviders } from "./notifications/infrastructure/providers/channel-registry"
import {
  NotificationController,
  NotificationPreferenceController,
  PushDeviceController,
} from "./notifications/presentation/notification.controller"
import { RealtimeGateway } from "./realtime/realtime.gateway"
import { RealtimePublisher } from "./realtime/realtime.publisher"

/**
 * Messagerie liée aux annonces, visites, notifications (in-app, e-mail, SMS ;
 * push et WhatsApp préparés mais désactivés) et temps réel. PostgreSQL est la
 * source de vérité et la file des envois (outbox) ; Redis est facultatif.
 */
@Module({
  imports: [IdentityModule, MediaModule],
  controllers: [
    ConversationController,
    AppointmentController,
    NotificationController,
    NotificationPreferenceController,
    PushDeviceController,
  ],
  providers: [
    CommunicationConfig,
    CommunicationActivity,
    ...channelProviders,
    NotificationDispatcher,
    NotificationService,
    DeliveryRepository,
    DeliveryRunner,
    PreferenceService,
    PushDeviceService,
    RealtimePublisher,
    RealtimeGateway,
    ConversationRepository,
    ConversationAccessService,
    MessageService,
    ConversationService,
    ConversationModerationService,
    AppointmentService,
    AppointmentReminders,
  ],
  exports: [NotificationService, ConversationModerationService, DeliveryRunner],
})
export class CommunicationModule {}
