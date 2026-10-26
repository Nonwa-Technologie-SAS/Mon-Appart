import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"

import type { DomainEvent } from "./domain-event"

/**
 * Publication en processus. Les événements métier durables passent par
 * l'outbox PostgreSQL puis ce relais. La charge utile n'est pas journalisée.
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
        producer: event.producer,
        correlation_id: event.correlationId ?? undefined,
        causation_id: event.causationId ?? undefined,
        trace_id: event.traceId ?? undefined,
      }),
    )
    this.events.emit(event.name, event)
  }
}
