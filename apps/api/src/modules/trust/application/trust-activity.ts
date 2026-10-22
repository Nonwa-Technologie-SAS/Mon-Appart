import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"

@Injectable()
export class TrustActivity extends ActivityRecorder {
  constructor(events: DomainEventPublisher) {
    super(new Logger("Trust"), events)
  }
}
