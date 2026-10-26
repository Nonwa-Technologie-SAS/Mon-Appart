import { Global, Module } from "@nestjs/common"
import { EventEmitterModule } from "@nestjs/event-emitter"

import { DomainEventPublisher } from "./domain-event.publisher"
import { InboxService } from "./inbox.service"
import { OutboxConfig } from "./outbox.config"
import { OutboxDispatcher } from "./outbox.dispatcher"
import { OutboxRepository } from "./outbox.repository"
import { OutboxService } from "./outbox.service"

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    DomainEventPublisher,
    OutboxConfig,
    OutboxRepository,
    InboxService,
    OutboxDispatcher,
    OutboxService,
  ],
  exports: [
    DomainEventPublisher,
    OutboxConfig,
    OutboxRepository,
    InboxService,
    OutboxDispatcher,
    OutboxService,
  ],
})
export class DomainEventsModule {}
