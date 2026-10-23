import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"

import { safeErrorMessage } from "../../../../common/http/safe-error"
import { AppointmentReminders } from "../../appointments/application/appointment-reminders"
import { SavedSearchAlerts } from "../../appointments/application/saved-search-alerts"
import { CommunicationActivity } from "../../communication-activity"
import { CommunicationConfig } from "../../communication.config"
import {
  CommunicationEvent,
  RealtimeEvent,
} from "../../domain/communication-events"
import { RealtimePublisher } from "../../realtime/realtime.publisher"
import {
  decide,
  errorLabel,
  type ProviderError,
} from "../domain/delivery-policy"
import {
  hasDestination,
  isEnabled,
  preferenceKey,
  type ExternalChannel,
} from "../domain/notification-policy"
import {
  renderEmail,
  renderPush,
  renderSms,
  type TemplateInput,
} from "../domain/templates"
import {
  DeliveryRepository,
  type ClaimedDelivery,
  type DeliveryRow,
} from "../infrastructure/delivery.repository"
import type { SendResult } from "../infrastructure/providers/channel-provider"
import { ChannelRegistry } from "../infrastructure/providers/channel-registry"
import { toNotificationView } from "./notification.service"

export type DeliveryOutcome = "SENT" | "RETRY" | "FAILED" | "CANCELLED" | "LOST"

const BLOCKED_STATUSES = new Set(["SUSPENDED", "BANNED", "INACTIVE"])
const REMINDER_INTERVAL_MS = 60_000
const ALERT_INTERVAL_MS = 120_000

/**
 * Worker des livraisons, dans le processus de l'API (aucun Redis requis) :
 * réclame les livraisons échues, revérifie préférences et destinataire, appelle
 * le fournisseur avec un délai maximal, puis planifie une reprise (backoff) ou
 * conclut. Plusieurs instances peuvent tourner (SKIP LOCKED). Il envoie aussi
 * les rappels de visite échus.
 */
@Injectable()
export class DeliveryRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger("DeliveryRunner")
  private timer: NodeJS.Timeout | null = null
  private running: Promise<unknown> | null = null
  private stopping = false
  private lastReminders = 0
  private lastAlerts = 0

  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly channels: ChannelRegistry,
    private readonly realtime: RealtimePublisher,
    private readonly reminders: AppointmentReminders,
    private readonly alerts: SavedSearchAlerts,
    private readonly config: CommunicationConfig,
    private readonly activity: CommunicationActivity,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.worker.enabled) return
    this.schedule(this.config.worker.pollMs)
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true
    if (this.timer) clearTimeout(this.timer)
    await this.running?.catch(() => undefined)
  }

  @OnEvent(CommunicationEvent.DELIVERIES_QUEUED, {
    async: true,
    suppressErrors: true,
  })
  onQueued(): void {
    if (this.config.worker.enabled && !this.running) this.schedule(0)
  }

  /** Traite les livraisons échues (borné). Utilisé par le worker et les tests. */
  async runOnce(maxJobs = 200): Promise<Record<DeliveryOutcome, number>> {
    const counts: Record<DeliveryOutcome, number> = {
      SENT: 0,
      RETRY: 0,
      FAILED: 0,
      CANCELLED: 0,
      LOST: 0,
    }
    const leaseSeconds = Math.ceil(
      (this.config.worker.providerTimeoutMs * 3) / 1_000,
    )
    let processed = 0
    while (processed < maxJobs && !this.stopping) {
      const jobs = await this.deliveries.claim(
        Math.min(this.config.worker.batchSize, maxJobs - processed),
        leaseSeconds,
      )
      if (jobs.length === 0) break
      const outcomes = await Promise.all(
        jobs.map((job) =>
          this.process(job).catch((error: unknown) => {
            this.logger.error(
              JSON.stringify({
                action: "notification.delivery_crashed",
                error: safeErrorMessage(error),
              }),
            )
            return "LOST" as const
          }),
        ),
      )
      for (const outcome of outcomes) counts[outcome]++
      processed += jobs.length
    }
    return counts
  }

  async runReminders(force = false): Promise<number> {
    if (!force && Date.now() - this.lastReminders < REMINDER_INTERVAL_MS) {
      return 0
    }
    this.lastReminders = Date.now()
    return this.reminders.sendDue()
  }

  async runAlerts(force = false): Promise<number> {
    if (!force && Date.now() - this.lastAlerts < ALERT_INTERVAL_MS) {
      return 0
    }
    this.lastAlerts = Date.now()
    return this.alerts.sendDue()
  }

  private async process(job: ClaimedDelivery): Promise<DeliveryOutcome> {
    const delivery = await this.deliveries.load(job.id)
    if (!delivery) return "LOST"
    const { notification } = delivery
    const user = notification.user

    if (user.deletedAt || BLOCKED_STATUSES.has(user.status)) {
      return this.cancel(job, delivery, "USER_UNAVAILABLE")
    }
    if (notification.expiresAt && notification.expiresAt <= new Date()) {
      return this.cancel(job, delivery, "EXPIRED")
    }

    if (delivery.channel === "IN_APP") {
      this.realtime.toUsers([user.publicId], RealtimeEvent.NOTIFICATION_NEW, {
        notification: serializeNotification(notification),
      })
      return this.conclude(job, delivery, { ok: true, externalId: null }, null)
    }

    const channel = delivery.channel
    // Un message lu entre-temps n'a plus à être relayé hors de l'application.
    if (notification.category === "MESSAGES" && notification.readAt) {
      return this.cancel(job, delivery, "READ")
    }
    const stored = await this.deliveries.preferences(
      user.id,
      notification.category,
    )
    const preferences = new Map(
      stored.map((row) => [
        preferenceKey(row.category, row.channel),
        row.enabled,
      ]),
    )
    if (!isEnabled(notification.category, channel, preferences)) {
      return this.cancel(job, delivery, "PREFERENCE")
    }

    const template: TemplateInput = {
      category: notification.category,
      title: notification.title,
      body: notification.body,
      link: this.config.webAppUrl
        ? `${this.config.webAppUrl}/notifications`
        : null,
    }
    const signal = AbortSignal.timeout(this.config.worker.providerTimeoutMs)
    const reference = delivery.publicId
    let result: SendResult | null = null
    let provider: string | null = null
    let pushTokens: string[] = []

    switch (channel) {
      case "EMAIL": {
        const email = this.channels.email
        if (!email) break
        if (!user.email || !user.emailVerifiedAt) {
          return this.cancel(job, delivery, "NO_DESTINATION")
        }
        provider = email.name
        result = await email.send(
          { to: user.email, content: renderEmail(template), reference },
          signal,
        )
        break
      }
      case "SMS": {
        const sms = this.channels.sms
        if (!sms) break
        if (!user.phone || !user.phoneVerifiedAt) {
          return this.cancel(job, delivery, "NO_DESTINATION")
        }
        provider = sms.name
        result = await sms.send(
          { to: user.phone, text: renderSms(template), reference },
          signal,
        )
        break
      }
      case "PUSH": {
        const push = this.channels.push
        if (!push) break
        const devices = await this.deliveries.activePushTokens(user.id)
        if (devices.length === 0) {
          return this.cancel(job, delivery, "NO_DESTINATION")
        }
        pushTokens = devices.map((device) => device.token)
        provider = push.name
        result = await push.send(
          {
            tokens: pushTokens,
            content: renderPush(template),
            data: {
              notificationId: notification.publicId,
              type: notification.type,
            },
            reference,
          },
          signal,
        )
        break
      }
      case "WHATSAPP": {
        const whatsapp = this.channels.whatsapp
        if (!whatsapp) break
        if (!user.phone || !user.phoneVerifiedAt) {
          return this.cancel(job, delivery, "NO_DESTINATION")
        }
        provider = whatsapp.name
        result = await whatsapp.send(
          {
            to: user.phone,
            template: `notification_${notification.category.toLowerCase()}`,
            variables: [notification.title],
            reference,
          },
          signal,
        )
        break
      }
    }
    // Fournisseur retiré depuis la planification : rien n'est simulé.
    if (!result) return this.cancel(job, delivery, "CHANNEL_DISABLED")

    if (!result.ok && channel === "PUSH" && result.invalidTokens?.length) {
      await this.deliveries.invalidatePushTokens(user.id, result.invalidTokens)
    }
    return this.conclude(job, delivery, result, provider)
  }

  private async conclude(
    job: ClaimedDelivery,
    delivery: DeliveryRow,
    result: SendResult,
    provider: string | null,
  ): Promise<DeliveryOutcome> {
    const channel = delivery.channel
    const error: ProviderError | null = result.ok ? null : result.error
    const decision = decide({
      error,
      attempt: job.attempt,
      maxAttempts: this.config.worker.maxAttempts,
      baseSeconds: this.config.worker.retryBaseSeconds,
    })
    const now = new Date()
    const metrics = this.activity.metrics.communication

    if (decision.status === "SENT") {
      const owned = await this.deliveries.finish(job, {
        status: "SENT",
        provider,
        sentAt: now,
        nextAttemptAt: null,
        lastError: null,
        externalId: result.ok ? result.externalId : null,
      })
      if (!owned) return "LOST"
      metrics.deliveries.inc({ channel, outcome: "sent" })
      metrics.deliveryLatency.observe(
        { channel },
        now.getTime() - delivery.notification.createdAt.getTime(),
      )
      return "SENT"
    }

    if (decision.status === "RETRY") {
      const owned = await this.deliveries.finish(job, {
        status: "PENDING",
        provider,
        nextAttemptAt: new Date(now.getTime() + decision.delayMs),
        lastError: errorLabel(error!),
      })
      if (!owned) return "LOST"
      metrics.deliveryRetries.inc({ channel, reason: error!.kind })
      this.logOutcome("notification.delivery_retry", delivery, error!)
      return "RETRY"
    }

    const owned = await this.deliveries.finish(job, {
      status: "FAILED",
      provider,
      failedAt: now,
      nextAttemptAt: null,
      lastError: errorLabel(error!),
    })
    if (!owned) return "LOST"
    metrics.deliveries.inc({ channel, outcome: "failed" })
    this.logOutcome("notification.delivery_failed", delivery, error!)
    if (decision.fallback) await this.fallback(delivery)
    return "FAILED"
  }

  /**
   * Repli explicite et configuré, sur un seul niveau : une livraison issue
   * d'un repli n'en déclenche pas d'autre, et l'unicité (notification, canal)
   * empêche toute boucle.
   */
  private async fallback(delivery: DeliveryRow): Promise<void> {
    if (delivery.fallbackFromId !== null || delivery.channel === "IN_APP") {
      return
    }
    const target = this.config.fallbacks.get(delivery.channel)
    if (!target || target === "IN_APP") return
    const { notification } = delivery
    const user = notification.user
    const stored = await this.deliveries.preferences(
      user.id,
      notification.category,
    )
    const preferences = new Map(
      stored.map((row) => [
        preferenceKey(row.category, row.channel),
        row.enabled,
      ]),
    )
    const pushDevices =
      target === "PUSH"
        ? (await this.deliveries.activePushTokens(user.id)).length
        : 0
    const eligible =
      this.channels.available().has(target as ExternalChannel) &&
      isEnabled(notification.category, target, preferences) &&
      hasDestination(target as ExternalChannel, {
        emailVerified: Boolean(user.email && user.emailVerifiedAt),
        phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
        activePushDevices: pushDevices,
      })
    if (!eligible) return
    await this.deliveries.insertFallback(notification.id, target, delivery.id)
  }

  private async cancel(
    job: ClaimedDelivery,
    delivery: DeliveryRow,
    reason: string,
  ): Promise<DeliveryOutcome> {
    const owned = await this.deliveries.finish(job, {
      status: "CANCELLED",
      nextAttemptAt: null,
      lastError: reason,
    })
    if (!owned) return "LOST"
    this.activity.metrics.communication.deliveries.inc({
      channel: delivery.channel,
      outcome: "cancelled",
    })
    return "CANCELLED"
  }

  private logOutcome(
    action: string,
    delivery: DeliveryRow,
    error: ProviderError,
  ): void {
    this.activity.log(action, null, {
      delivery_id: delivery.publicId,
      notification_id: delivery.notification.publicId,
      channel: delivery.channel,
      error_kind: error.kind,
      error_code: error.code,
    })
  }

  private schedule(delay: number): void {
    if (this.stopping) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.running = this.cycle().finally(() => {
        this.running = null
        this.schedule(this.config.worker.pollMs)
      })
    }, delay)
    this.timer.unref()
  }

  private async cycle(): Promise<void> {
    try {
      await this.runReminders()
      await this.runAlerts()
      await this.runOnce()
      this.deliveries
        .countPending()
        .then((count) =>
          this.activity.metrics.communication.pendingDeliveries.set(count),
        )
        .catch(() => undefined)
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          action: "notification.worker_cycle_failed",
          error: safeErrorMessage(error),
        }),
      )
    }
  }
}

export function serializeNotification(row: DeliveryRow["notification"]) {
  const view = toNotificationView(row)
  return {
    ...view,
    readAt: view.readAt?.toISOString() ?? null,
    createdAt: view.createdAt.toISOString(),
  }
}
