import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../../database/database.service"
import type {
  NotificationCategory,
  NotificationChannel,
} from "../../../../generated/prisma/enums"
import type { Actor, ClientContext } from "../../../identity"
import { CommunicationActivity } from "../../communication-activity"
import { communicationError } from "../../domain/communication-errors"
import {
  CommunicationAuditAction,
  USER_ENTITY,
} from "../../domain/communication-events"
import {
  CATEGORIES,
  CHANNELS,
  isEnabled,
  isLocked,
  preferenceKey,
  type ExternalChannel,
} from "../domain/notification-policy"
import { ChannelRegistry } from "../infrastructure/providers/channel-registry"

export interface PreferenceCell {
  category: NotificationCategory
  channel: NotificationChannel
  enabled: boolean
  /** Nécessaire au service : ne peut pas être désactivé. */
  locked: boolean
  /** Un fournisseur est configuré pour ce canal. */
  available: boolean
}

export interface PreferenceChange {
  category: NotificationCategory
  channel: NotificationChannel
  enabled: boolean
}

@Injectable()
export class PreferenceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly channels: ChannelRegistry,
    private readonly activity: CommunicationActivity,
  ) {}

  async matrix(userId: bigint): Promise<PreferenceCell[]> {
    const rows = await this.db.client.notificationPreference.findMany({
      where: { userId },
      select: { category: true, channel: true, enabled: true },
    })
    const stored = new Map(
      rows.map((row) => [
        preferenceKey(row.category, row.channel),
        row.enabled,
      ]),
    )
    const available = this.channels.available()
    return CATEGORIES.flatMap((category) =>
      CHANNELS.map((channel) => ({
        category,
        channel,
        enabled: isEnabled(category, channel, stored),
        locked: isLocked(category, channel),
        available:
          channel === "IN_APP" || available.has(channel as ExternalChannel),
      })),
    )
  }

  /**
   * Remplace les choix listés (les autres restent inchangés). Désactiver un
   * canal verrouillé est refusé ; le réactiver est sans effet.
   */
  async update(
    actor: Actor,
    changes: PreferenceChange[],
    client: ClientContext,
  ): Promise<PreferenceCell[]> {
    for (const change of changes) {
      if (!change.enabled && isLocked(change.category, change.channel)) {
        throw communicationError(
          "PREFERENCE_LOCKED",
          `${change.category}/${change.channel}`,
        )
      }
    }
    const effective = dedupe(changes).filter(
      (change) => !isLocked(change.category, change.channel),
    )
    if (effective.length > 0) {
      await this.db.transaction(async (tx) => {
        for (const change of effective) {
          await tx.notificationPreference.upsert({
            where: {
              userId_category_channel: {
                userId: actor.userId,
                category: change.category,
                channel: change.channel,
              },
            },
            create: { userId: actor.userId, ...change },
            update: { enabled: change.enabled },
          })
        }
        await this.activity.audit(
          {
            action: CommunicationAuditAction.NOTIFICATION_PREFERENCES_UPDATED,
            actorId: actor.userId,
            entityType: USER_ENTITY,
            entityId: actor.publicId,
            newValues: {
              changes: effective.map(
                (change) =>
                  `${change.category}:${change.channel}:${change.enabled ? "on" : "off"}`,
              ),
            },
          },
          client,
          tx,
        )
      })
    }
    return this.matrix(actor.userId)
  }
}

function dedupe(changes: PreferenceChange[]): PreferenceChange[] {
  const byKey = new Map<string, PreferenceChange>()
  for (const change of changes) {
    byKey.set(preferenceKey(change.category, change.channel), change)
  }
  return [...byKey.values()]
}
