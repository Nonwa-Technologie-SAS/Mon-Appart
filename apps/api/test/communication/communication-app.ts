import type { AddressInfo } from "node:net"

import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../../src/app.module"
import { configureApp } from "../../src/configure-app"
import { CommunicationConfig } from "../../src/modules/communication/communication.config"
import type { ProviderError } from "../../src/modules/communication/notifications/domain/delivery-policy"
import {
  NOTIFICATION_EMAIL_PROVIDER,
  NOTIFICATION_SMS_PROVIDER,
  type ChannelProvider,
  type EmailMessage,
  type SendResult,
  type SmsMessage,
} from "../../src/modules/communication/notifications/infrastructure/providers/channel-provider"
import { DevNotificationProvider } from "../../src/modules/identity/infrastructure/providers/notification.providers"
import { connect } from "../database/db"
import type { IdentityTestApp } from "../identity/identity-app"

/**
 * Fournisseur simulé : enregistre chaque envoi et rejoue, par destinataire,
 * les échecs mis en file (succès sinon). Aucun compte externe n'est contacté.
 */
export class FakeProvider<
  TMessage extends { to: string },
> implements ChannelProvider<TMessage> {
  readonly sent: TMessage[] = []
  private readonly queued = new Map<string, ProviderError[]>()

  constructor(readonly name: string) {}

  /** Échecs des prochains envois vers `to`, dans l'ordre. */
  failFor(to: string, ...errors: ProviderError[]): void {
    this.queued.set(to, [...(this.queued.get(to) ?? []), ...errors])
  }

  reset(): void {
    this.sent.length = 0
    this.queued.clear()
  }

  async send(message: TMessage): Promise<SendResult> {
    this.sent.push(message)
    const error = this.queued.get(message.to)?.shift()
    return error
      ? { ok: false, error }
      : { ok: true, externalId: `fake-${this.sent.length}` }
  }
}

export interface CommunicationTestApp extends IdentityTestApp {
  email: FakeProvider<EmailMessage>
  sms: FakeProvider<SmsMessage>
  /** URL du serveur HTTP réel (Socket.IO). */
  baseUrl: string
}

/** Application complète sur la base *_test, fournisseurs simulés, port éphémère. */
export async function createCommunicationApp(
  overrides: Partial<Record<keyof CommunicationConfig, unknown>> = {},
): Promise<CommunicationTestApp> {
  const email = new FakeProvider<EmailMessage>("fake-email")
  const sms = new FakeProvider<SmsMessage>("fake-sms")
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CommunicationConfig)
    .useFactory({
      inject: [ConfigService],
      factory: (config: ConfigService) =>
        Object.assign(new CommunicationConfig(config), overrides),
    })
    .overrideProvider(NOTIFICATION_EMAIL_PROVIDER)
    .useValue(email)
    .overrideProvider(NOTIFICATION_SMS_PROVIDER)
    .useValue(sms)
    .compile()

  const databaseUrl =
    moduleRef.get(ConfigService).get<string>("DATABASE_URL") ?? ""
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
    throw new Error("Les tests Communication exigent une DATABASE_URL *_test")
  }

  const app = moduleRef.createNestApplication({ bufferLogs: true })
  configureApp(app)
  await app.listen(0, "127.0.0.1")
  const { port } = app.getHttpServer().address() as AddressInfo

  const db = await connect()
  return {
    app,
    http: request(app.getHttpServer()),
    outbox: app.get(DevNotificationProvider),
    db,
    email,
    sms,
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await db.end()
      await app.close()
    },
  }
}

/** Contacts vérifiés directement en base : destinations des canaux externes. */
export async function verifyContacts(
  test: IdentityTestApp,
  userId: string,
  contacts: { email?: boolean; phone?: boolean } = { email: true, phone: true },
): Promise<void> {
  await test.db.query(
    `UPDATE users SET
       email_verified_at = CASE WHEN $2 THEN now() ELSE NULL END,
       phone_verified_at = CASE WHEN $3 THEN now() ELSE NULL END
     WHERE public_id = $1`,
    [userId, Boolean(contacts.email), Boolean(contacts.phone)],
  )
}

export async function deliveriesOf(test: IdentityTestApp, userId: string) {
  const result = await test.db.query<{
    channel: string
    status: string
    attempts: number
    last_error: string | null
    provider: string | null
    external_id: string | null
    fallback: boolean
    title: string
    category: string
  }>(
    `SELECT d.channel, d.status, d.attempts, d.last_error, d.provider,
            d.external_id, d.fallback_from_id IS NOT NULL AS fallback,
            n.title, n.category
     FROM notification_deliveries d
     JOIN notifications n ON n.id = d.notification_id
     JOIN users u ON u.id = n.user_id
     WHERE u.public_id = $1
     ORDER BY d.id`,
    [userId],
  )
  return result.rows
}

/** Rend immédiatement échues les livraisons planifiées (délai, backoff). */
export async function makeDeliveriesDue(test: IdentityTestApp): Promise<void> {
  await test.db.query(
    `UPDATE notification_deliveries SET next_attempt_at = now() - interval '1 second'
     WHERE status = 'PENDING' AND next_attempt_at > now()`,
  )
}
