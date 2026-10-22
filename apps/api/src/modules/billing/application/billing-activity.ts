import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { MetricsService } from "../../../observability/metrics.service"

@Injectable()
export class BillingActivity extends ActivityRecorder {
  constructor(
    events: DomainEventPublisher,
    readonly metrics: MetricsService,
  ) {
    super(new Logger("Billing"), events)
  }
}
