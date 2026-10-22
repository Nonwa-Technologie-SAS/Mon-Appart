import { Inject, Injectable, Optional, type Provider } from "@nestjs/common"

import { CommunicationConfig } from "../../../communication.config"
import type { ExternalChannel } from "../../domain/notification-policy"
import {
  NOTIFICATION_EMAIL_PROVIDER,
  NOTIFICATION_PUSH_PROVIDER,
  NOTIFICATION_SMS_PROVIDER,
  NOTIFICATION_WHATSAPP_PROVIDER,
  type EmailProvider,
  type PushProvider,
  type SmsProvider,
  type WhatsAppProvider,
} from "./channel-provider"
import { HttpSmsProvider } from "./http-sms.provider"
import { SmtpEmailProvider } from "./smtp-email.provider"

/**
 * Fournisseurs réellement configurés. Un canal sans fournisseur est
 * indisponible : aucune livraison n'est planifiée et rien n'est simulé.
 */
@Injectable()
export class ChannelRegistry {
  constructor(
    @Optional()
    @Inject(NOTIFICATION_EMAIL_PROVIDER)
    readonly email: EmailProvider | null,
    @Optional()
    @Inject(NOTIFICATION_SMS_PROVIDER)
    readonly sms: SmsProvider | null,
    @Optional()
    @Inject(NOTIFICATION_PUSH_PROVIDER)
    readonly push: PushProvider | null,
    @Optional()
    @Inject(NOTIFICATION_WHATSAPP_PROVIDER)
    readonly whatsapp: WhatsAppProvider | null,
  ) {}

  available(): Set<ExternalChannel> {
    const channels = new Set<ExternalChannel>()
    if (this.email) channels.add("EMAIL")
    if (this.sms) channels.add("SMS")
    if (this.push) channels.add("PUSH")
    if (this.whatsapp) channels.add("WHATSAPP")
    return channels
  }
}

export const channelProviders: Provider[] = [
  {
    provide: NOTIFICATION_EMAIL_PROVIDER,
    inject: [CommunicationConfig],
    useFactory: (config: CommunicationConfig): EmailProvider | null =>
      config.smtp
        ? new SmtpEmailProvider(config.smtp, config.worker.providerTimeoutMs)
        : null,
  },
  {
    provide: NOTIFICATION_SMS_PROVIDER,
    inject: [CommunicationConfig],
    useFactory: (config: CommunicationConfig): SmsProvider | null =>
      config.sms ? new HttpSmsProvider(config.sms) : null,
  },
  // Interfaces prêtes, sans adaptateur livré : canaux désactivés.
  { provide: NOTIFICATION_PUSH_PROVIDER, useValue: null },
  { provide: NOTIFICATION_WHATSAPP_PROVIDER, useValue: null },
  ChannelRegistry,
]
