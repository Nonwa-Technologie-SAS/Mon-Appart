import type { ProviderError } from "../../domain/delivery-policy"
import type { EmailContent, PushContent } from "../../domain/templates"

/**
 * `ok: true` signifie que le fournisseur a **accepté** l'envoi, pas que le
 * destinataire l'a reçu ni lu : la livraison passe à SENT, jamais à DELIVERED
 * sans accusé de réception du fournisseur.
 */
export type SendResult =
  | { ok: true; externalId: string | null }
  | {
      ok: false
      error: ProviderError
      /** Push : jetons refusés par le fournisseur (à invalider). */
      invalidTokens?: string[]
    }

export interface EmailMessage {
  to: string
  content: EmailContent
  /** Identifiant public de la livraison : clé d'idempotence côté fournisseur. */
  reference: string
}

export interface SmsMessage {
  to: string
  text: string
  reference: string
}

export interface PushMessage {
  tokens: string[]
  content: PushContent
  /** Identifiants publics seulement (notification, type). */
  data: Record<string, string>
  reference: string
}

export interface WhatsAppMessage {
  to: string
  /** Modèle préapprouvé par Meta et ses variables : jamais de texte libre. */
  template: string
  variables: string[]
  reference: string
}

export interface ChannelProvider<TMessage> {
  /** Nom court stocké dans `notification_deliveries.provider`. */
  readonly name: string
  send(message: TMessage, signal: AbortSignal): Promise<SendResult>
}

export type EmailProvider = ChannelProvider<EmailMessage>
export type SmsProvider = ChannelProvider<SmsMessage>
/**
 * Push mobile (FCM / APNs). Aucune implémentation n'est livrée : le canal
 * reste indisponible tant qu'un adaptateur n'est pas enregistré.
 */
export type PushProvider = ChannelProvider<PushMessage>
/**
 * WhatsApp Business Platform (API officielle Cloud API, modèles approuvés).
 * Aucune implémentation n'est livrée ; aucun contournement non officiel.
 */
export type WhatsAppProvider = ChannelProvider<WhatsAppMessage>

export const NOTIFICATION_EMAIL_PROVIDER = Symbol("NOTIFICATION_EMAIL_PROVIDER")
export const NOTIFICATION_SMS_PROVIDER = Symbol("NOTIFICATION_SMS_PROVIDER")
export const NOTIFICATION_PUSH_PROVIDER = Symbol("NOTIFICATION_PUSH_PROVIDER")
export const NOTIFICATION_WHATSAPP_PROVIDER = Symbol(
  "NOTIFICATION_WHATSAPP_PROVIDER",
)

export function abortedResult(signal: AbortSignal): SendResult | null {
  return signal.aborted
    ? { ok: false, error: { kind: "TIMEOUT", code: "TIMEOUT" } }
    : null
}
