import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { OutboxService } from "../../../common/events/outbox.service"
import { MetricsService } from "../../../observability/metrics.service"

@Injectable()
export class ListingActivity extends ActivityRecorder {
  constructor(
    events: DomainEventPublisher,
    readonly metrics: MetricsService,
    outbox: OutboxService,
  ) {
    super(new Logger("Listing"), events, outbox)
  }
}
