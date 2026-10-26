import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import type { OutboxDraft } from "../../../../common/events/event-schema"
import { DomainEventPublisher } from "../../../../common/events/domain-event.publisher"
import { OutboxService } from "../../../../common/events/outbox.service"
import { safeErrorMessage } from "../../../../common/http/safe-error"
import { MetricsService } from "../../../../observability/metrics.service"
import type {
  AuditAction,
  IdentityEventName,
} from "../../domain/identity-events"
import type { Db } from "../../infrastructure/persistence/identity-database"
import {
  AuditRepository,
  type AuditEntry,
} from "../../infrastructure/repositories/audit.repository"
import type { ClientContext } from "../client-context"

type LogFields = Record<string, string | number | boolean | null | undefined>

/**
 * Audit, événements, logs et métriques du module. Aucun secret ne transite ici :
 * les appelants ne passent que des identifiants publics et des motifs.
 */
@Injectable()
export class IdentityActivity {
  private readonly logger = new Logger("Identity")

  constructor(
    private readonly auditLogs: AuditRepository,
    private readonly events: DomainEventPublisher,
    private readonly outbox: OutboxService,
    readonly metrics: MetricsService,
  ) {}

  /**
   * Dans une transaction, une erreur d'audit annule l'opération. Hors
   * transaction, elle est journalisée sans bloquer l'utilisateur.
   */
  async audit(
    entry: Omit<
      AuditEntry,
      "action" | "ipAddress" | "userAgent" | "requestId"
    > & {
      action: AuditAction
    },
    context: ClientContext | null,
    tx?: Db,
  ): Promise<void> {
    const full: AuditEntry = {
      ...entry,
      ipAddress: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      requestId: context?.requestId ?? null,
    }
    if (tx) {
      await this.auditLogs.insert(full, tx)
      return
    }
    try {
      await this.auditLogs.insert(full)
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          action: "audit_failed",
          audit_action: entry.action,
          error: safeErrorMessage(error),
        }),
      )
    }
  }

  enqueue(tx: Db, draft: OutboxDraft): Promise<string> {
    return this.outbox.append(tx, draft)
  }

  flush(): Promise<number> {
    return this.outbox.flush()
  }

  emit<TPayload extends object>(
    name: IdentityEventName,
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
    context: ClientContext | null,
    fields: LogFields = {},
  ): void {
    this.logger.log(this.format(action, context, fields))
  }

  warn(
    action: string,
    context: ClientContext | null,
    fields: LogFields = {},
  ): void {
    this.logger.warn(this.format(action, context, fields))
  }

  private format(
    action: string,
    context: ClientContext | null,
    fields: LogFields,
  ): string {
    return JSON.stringify({
      action,
      request_id: context?.requestId ?? undefined,
      ip: context?.ip ?? undefined,
      user_agent: context?.userAgent ?? undefined,
      ...fields,
    })
  }
}
