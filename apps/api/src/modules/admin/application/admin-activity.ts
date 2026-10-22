import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"

export const AdminAuditAction = {
  NOTE_ADDED: "ADMIN_NOTE_ADDED",
  USER_CONTACT_VIEWED: "USER_CONTACT_VIEWED",
  LISTING_MODERATED: "LISTING_MODERATED",
  MODERATION_REASON_CREATED: "MODERATION_REASON_CREATED",
  MODERATION_REASON_UPDATED: "MODERATION_REASON_UPDATED",
} as const

@Injectable()
export class AdminActivity extends ActivityRecorder {
  constructor(events: DomainEventPublisher) {
    super(new Logger("Admin"), events)
  }
}
