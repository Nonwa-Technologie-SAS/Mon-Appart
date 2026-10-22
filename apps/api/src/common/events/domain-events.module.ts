import { Global, Module } from "@nestjs/common"
import { EventEmitterModule } from "@nestjs/event-emitter"

import { DomainEventPublisher } from "./domain-event.publisher"

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEventPublisher],
  exports: [DomainEventPublisher],
})
export class DomainEventsModule {}
