import type { LoggerService } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import type { Db } from "../../database/database.service"
import { insertAuditLog, type AuditEntry } from "../audit/audit-log"
import type { DomainEventPublisher } from "../events/domain-event.publisher"

export interface RequestContext {
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>

/**
 * Audit, événements et logs structurés d'un module métier. Les appelants ne
 * passent que des identifiants publics, jamais de secret ni de donnée sensible.
 */
export class ActivityRecorder {
  constructor(
    private readonly logger: LoggerService,
    private readonly events: DomainEventPublisher,
  ) {}

  /** Toujours dans la transaction de l'opération : un audit raté l'annule. */
  async audit(
    entry: Omit<AuditEntry, "ipAddress" | "userAgent" | "requestId">,
    context: RequestContext | null,
    tx: Db,
  ): Promise<void> {
    await insertAuditLog(tx, {
      ...entry,
      ipAddress: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      requestId: context?.requestId ?? null,
    })
  }

  emit<TPayload extends object>(
    name: string,
    aggregateId: string,
    payload: TPayload,
  ): void {
    this.events.publish({
      id: randomUUID(),
      name,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
    })
  }

  log(
    action: string,
    context: RequestContext | null,
    fields: LogFields = {},
  ): void {
    this.logger.log(
      JSON.stringify({
        action,
        request_id: context?.requestId ?? undefined,
        ...fields,
      }),
    )
  }
}
