import { Injectable, Logger } from "@nestjs/common"

import { ActivityRecorder } from "../../../common/activity/activity-recorder"
import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { MetricsService } from "../../../observability/metrics.service"

/**
 * Audit, événements, logs et métriques du module. Les logs ne portent que des
 * identifiants publics, types, tailles et codes : jamais de clé de stockage,
 * d'URL signée, de nom de fichier ni de contenu.
 */
@Injectable()
export class MediaActivity extends ActivityRecorder {
  constructor(
    events: DomainEventPublisher,
    readonly metrics: MetricsService,
  ) {
    super(new Logger("Media"), events)
  }
}
