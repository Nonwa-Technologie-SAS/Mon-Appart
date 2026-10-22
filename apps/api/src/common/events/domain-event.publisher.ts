import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"

import type { DomainEvent } from "./domain-event"

/**
 * Publication en processus. Les événements critiques passeront plus tard
 * par une table outbox PostgreSQL avant d'être relayés vers Redis ou un bus.
 * La charge utile n'est pas journalisée.
 */
@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name)

  constructor(private readonly events: EventEmitter2) {}

  publish<TPayload extends object>(event: DomainEvent<TPayload>): void {
    this.logger.log(
      JSON.stringify({
        event: event.name,
        event_id: event.id,
        aggregate_id: event.aggregateId,
      }),
    )
    this.events.emit(event.name, event)
  }
}
