import { Injectable, Logger } from "@nestjs/common"

import { IdentityConfig } from "../../identity.config"
import { IdentityDatabase } from "../../infrastructure/persistence/identity-database"

export interface IdentityRetentionResult {
  otpDeleted: number
  resetTokensDeleted: number
  sessionsDeleted: number
}

/**
 * Purge des artefacts d'authentification expirés.
 * Ne touche pas aux AuditLog ni aux comptes utilisateurs.
 */
@Injectable()
export class IdentityRetentionService {
  private readonly logger = new Logger(IdentityRetentionService.name)

  constructor(
    private readonly db: IdentityDatabase,
    private readonly config: IdentityConfig,
  ) {}

  async purge(now = new Date()): Promise<IdentityRetentionResult> {
    const sessionCutoff = new Date(
      now.getTime() - this.config.sessionRetentionDays * 86_400_000,
    )

    const [otp, resets, sessions] = await Promise.all([
      this.db.client.otpChallenge.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { consumedAt: { not: null } },
          ],
        },
      }),
      this.db.client.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null } },
          ],
        },
      }),
      this.db.client.authSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: sessionCutoff } },
            {
              revokedAt: { not: null, lt: sessionCutoff },
            },
          ],
        },
      }),
    ])

    const result: IdentityRetentionResult = {
      otpDeleted: otp.count,
      resetTokensDeleted: resets.count,
      sessionsDeleted: sessions.count,
    }
    if (
      result.otpDeleted ||
      result.resetTokensDeleted ||
      result.sessionsDeleted
    ) {
      this.logger.log({
        msg: "identity.retention.purged",
        ...result,
      })
    }
    return result
  }
}
