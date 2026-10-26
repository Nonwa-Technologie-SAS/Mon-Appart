import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import type { NotificationChannel } from "../../generated/prisma/enums"
import { EXTERNAL_CHANNELS } from "./notifications/domain/notification-policy"

export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  user: string | null
  password: string | null
  from: string
}

export interface HttpSmsSettings {
  url: string
  token: string | null
  senderId: string | null
}

/** Configuration de la messagerie et des notifications, lue une fois. */
@Injectable()
export class CommunicationConfig {
  readonly messaging: {
    maxConversationsPerHour: number
    maxMessagesPerMinute: number
    repeatLimit: number
    maxAttachments: number
    externalDelaySeconds: number
  }
  readonly worker: {
    enabled: boolean
    pollMs: number
    batchSize: number
    maxAttempts: number
    retryBaseSeconds: number
    providerTimeoutMs: number
  }
  /** Canal de repli après échec définitif, un seul niveau. */
  readonly fallbacks: ReadonlyMap<NotificationChannel, NotificationChannel>
  readonly smtp: SmtpSettings | null
  readonly sms: HttpSmsSettings | null
  readonly realtime: {
    enabled: boolean
    revocationCheckMs: number
    eventRateLimit: number
  }
  readonly appointments: {
    reminderHours: number
    minNoticeMinutes: number
    maxDaysAhead: number
  }
  readonly alerts: {
    batchSize: number
    dailyMinHours: number
    weeklyMinDays: number
    reactivationIdleDays: number
    reactivationCooldownDays: number
    maxListingsPerDigest: number
  }
  readonly webAppUrl: string | null

  constructor(config: ConfigService) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }
    const str = (key: string) => config.get<string>(key)?.trim() || null
    const flag = (key: string, fallback: boolean) => {
      const value = config.get<string>(key)
      return value === undefined ? fallback : value === "true"
    }

    this.messaging = {
      maxConversationsPerHour: num("MESSAGING_MAX_CONVERSATIONS_PER_HOUR", 20),
      maxMessagesPerMinute: num("MESSAGING_MAX_MESSAGES_PER_MINUTE", 30),
      repeatLimit: num("MESSAGING_REPEAT_LIMIT", 5),
      maxAttachments: num("MESSAGING_MAX_ATTACHMENTS", 5),
      externalDelaySeconds: num("MESSAGING_EXTERNAL_DELAY_SECONDS", 300),
    }
    this.worker = {
      enabled: flag("NOTIFICATION_WORKER_ENABLED", true),
      pollMs: num("NOTIFICATION_WORKER_POLL_MS", 2_000),
      batchSize: num("NOTIFICATION_WORKER_BATCH_SIZE", 20),
      maxAttempts: num("NOTIFICATION_MAX_ATTEMPTS", 5),
      retryBaseSeconds: num("NOTIFICATION_RETRY_BASE_SECONDS", 30),
      providerTimeoutMs: num("NOTIFICATION_PROVIDER_TIMEOUT_MS", 10_000),
    }
    this.fallbacks = parseFallbacks(
      config.get<string>("NOTIFICATION_FALLBACKS"),
    )

    const smtpHost = str("SMTP_HOST")
    const from = str("EMAIL_FROM")
    this.smtp =
      config.get<string>("EMAIL_PROVIDER") === "smtp" && smtpHost && from
        ? {
            host: smtpHost,
            port: num("SMTP_PORT", 587),
            secure: flag("SMTP_SECURE", false),
            user: str("SMTP_USER"),
            password: str("SMTP_PASSWORD"),
            from,
          }
        : null

    const smsUrl = str("SMS_HTTP_URL")
    this.sms =
      config.get<string>("SMS_PROVIDER") === "http" && smsUrl
        ? {
            url: smsUrl,
            token: str("SMS_HTTP_TOKEN"),
            senderId: str("SMS_SENDER_ID"),
          }
        : null

    this.realtime = {
      enabled: flag("REALTIME_ENABLED", true),
      revocationCheckMs: num("REALTIME_REVOCATION_CHECK_SECONDS", 60) * 1_000,
      eventRateLimit: num("REALTIME_EVENT_RATE_LIMIT", 120),
    }
    this.appointments = {
      reminderHours: num("APPOINTMENT_REMINDER_HOURS", 24),
      minNoticeMinutes: num("APPOINTMENT_MIN_NOTICE_MINUTES", 60),
      maxDaysAhead: num("APPOINTMENT_MAX_DAYS_AHEAD", 90),
    }
    this.alerts = {
      batchSize: Math.min(100, num("SAVED_SEARCH_ALERT_BATCH", 25)),
      dailyMinHours: num("SAVED_SEARCH_DAILY_MIN_HOURS", 20),
      weeklyMinDays: num("SAVED_SEARCH_WEEKLY_MIN_DAYS", 6),
      reactivationIdleDays: num("REACTIVATION_IDLE_DAYS", 7),
      reactivationCooldownDays: num("REACTIVATION_COOLDOWN_DAYS", 14),
      maxListingsPerDigest: Math.min(10, num("SAVED_SEARCH_DIGEST_MAX", 5)),
    }
    this.webAppUrl = str("WEB_APP_URL")?.replace(/\/+$/, "") ?? null
  }
}

export function parseFallbacks(
  value: string | undefined,
): Map<NotificationChannel, NotificationChannel> {
  const result = new Map<NotificationChannel, NotificationChannel>()
  const external = new Set<string>(EXTERNAL_CHANNELS)
  for (const item of (value ?? "").split(",")) {
    const [from, to] = item.trim().toUpperCase().split(">")
    if (!from || !to || from === to || !external.has(from)) continue
    if (!external.has(to) || result.has(from as NotificationChannel)) continue
    // Un seul niveau : ni chaîne (A>B, B>C) ni cycle (A>B, B>A).
    const targets = new Set<string>(result.values())
    if (targets.has(from) || result.has(to as NotificationChannel)) continue
    result.set(from as NotificationChannel, to as NotificationChannel)
  }
  return result
}

/** Limites par minute et par IP, lues à la requête par le ThrottlerGuard. */
export const messagingRateLimit = (): number =>
  Number(process.env.MESSAGING_RATE_LIMIT) || 120
export const appointmentRateLimit = (): number =>
  Number(process.env.APPOINTMENT_RATE_LIMIT) || 30
