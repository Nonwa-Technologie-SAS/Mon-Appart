import { Injectable } from "@nestjs/common"

import { IdentityConfig } from "../../identity.config"

export type VerificationPurpose =
  | "PHONE_VERIFICATION"
  | "EMAIL_VERIFICATION"
  | "LOGIN"
  | "PASSWORD_RESET"
  | "PHONE_CHANGE"

export interface VerificationCodeMessage {
  to: string
  code: string
  purpose: VerificationPurpose
  expiresInMinutes: number
}

export interface PasswordResetMessage {
  to: string
  resetUrl: string
  expiresInMinutes: number
}

export interface WelcomeMessage {
  to: string
  firstName?: string | null
}

/** Port d'envoi d'email. L'implémentation réelle (SES, Brevo, ...) reste hors du domaine. */
export interface EmailProvider {
  sendVerificationCode(message: VerificationCodeMessage): Promise<void>
  sendPasswordReset(message: PasswordResetMessage): Promise<void>
  sendWelcomeEmail(message: WelcomeMessage): Promise<void>
}

/** Port d'envoi de SMS. L'implémentation réelle (Twilio, Orange, ...) reste hors du domaine. */
export interface SmsProvider {
  sendVerificationCode(message: VerificationCodeMessage): Promise<void>
  sendPasswordReset(message: PasswordResetMessage): Promise<void>
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER")
export const SMS_PROVIDER = Symbol("SMS_PROVIDER")

export interface OutboxEntry {
  channel: "EMAIL" | "SMS"
  kind: "verification_code" | "password_reset" | "welcome"
  to: string
  code?: string
  resetUrl?: string
  sentAt: Date
}

/**
 * Fournisseur de développement : conserve les derniers messages en mémoire
 * (lus par les tests) et ne les affiche sur la console que si
 * AUTH_DEV_PRINT_CODES=true en APP_ENV=local. Jamais via le logger applicatif.
 */
@Injectable()
export class DevNotificationProvider implements EmailProvider, SmsProvider {
  private readonly entries: OutboxEntry[] = []

  constructor(private readonly config: IdentityConfig) {}

  async sendVerificationCode(message: VerificationCodeMessage): Promise<void> {
    this.record({
      channel: message.to.includes("@") ? "EMAIL" : "SMS",
      kind: "verification_code",
      to: message.to,
      code: message.code,
      sentAt: new Date(),
    })
  }

  async sendPasswordReset(message: PasswordResetMessage): Promise<void> {
    this.record({
      channel: message.to.includes("@") ? "EMAIL" : "SMS",
      kind: "password_reset",
      to: message.to,
      resetUrl: message.resetUrl,
      sentAt: new Date(),
    })
  }

  async sendWelcomeEmail(message: WelcomeMessage): Promise<void> {
    this.record({
      channel: "EMAIL",
      kind: "welcome",
      to: message.to,
      sentAt: new Date(),
    })
  }

  /** Dernier message envoyé à une destination (tests et développement local). */
  latest(to: string, kind?: OutboxEntry["kind"]): OutboxEntry | undefined {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index]
      if (entry && entry.to === to && (!kind || entry.kind === kind))
        return entry
    }
    return undefined
  }

  private record(entry: OutboxEntry): void {
    this.entries.push(entry)
    if (this.entries.length > 200) this.entries.shift()
    if (this.config.devPrintCodes) {
      const secret = entry.code ?? entry.resetUrl ?? ""
      process.stdout.write(
        `[dev-notification] ${entry.channel} ${entry.kind} -> ${entry.to} ${secret}\n`,
      )
    }
  }
}
