import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../common/events/domain-event.publisher"
import { OutboxService } from "../../common/events/outbox.service"
import { MetricsService } from "../../observability/metrics.service"

/**
 * Audit, événements, logs et métriques du module. Les logs ne portent que des
 * identifiants publics, des types et des codes : jamais de corps de message,
 * d'adresse e-mail, de numéro de téléphone, de jeton push ni d'URL signée.
 */
@Injectable()
export class CommunicationActivity extends ActivityRecorder {
  constructor(
    events: DomainEventPublisher,
    readonly metrics: MetricsService,
    outbox: OutboxService,
  ) {
    super(new Logger("Communication"), events, outbox)
  }
}
