import { Logger, Module, type OnModuleInit } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { PasswordHasher } from "../../common/security/password-hasher"
import { AccountAdminService } from "./application/services/account-admin.service"
import { ActorService } from "./application/services/actor.service"
import { AuthThrottle } from "./application/services/auth-throttle.service"
import { AuthService } from "./application/services/auth.service"
import { IdentityActivity } from "./application/services/identity-activity.service"
import { IdentityRetentionService } from "./application/services/identity-retention.service"
import { IdentityRetentionWorker } from "./application/services/identity-retention.worker"
import { PasswordService } from "./application/services/password.service"
import { ProfileService } from "./application/services/profile.service"
import { SessionService } from "./application/services/session.service"
import { VerificationService } from "./application/services/verification.service"
import { IdentityConfig } from "./identity.config"
import { SecretHasher } from "./infrastructure/crypto/secret-hasher"
import { IdentityDatabase } from "./infrastructure/persistence/identity-database"
import {
  DevNotificationProvider,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
} from "./infrastructure/providers/notification.providers"
import { AuthRateLimiter } from "./infrastructure/rate-limit/auth-rate-limiter"
import { AuditRepository } from "./infrastructure/repositories/audit.repository"
import { OtpChallengeRepository } from "./infrastructure/repositories/otp-challenge.repository"
import { PasswordResetRepository } from "./infrastructure/repositories/password-reset.repository"
import { RbacRepository } from "./infrastructure/repositories/rbac.repository"
import { SessionRepository } from "./infrastructure/repositories/session.repository"
import { UserRepository } from "./infrastructure/repositories/user.repository"
import { AccessTokenService } from "./infrastructure/tokens/access-token.service"
import { SessionRevocationStore } from "./infrastructure/tokens/session-revocation.store"
import { AccountController } from "./presentation/controllers/account.controller"
import { AuthController } from "./presentation/controllers/auth.controller"
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard"
import { PermissionsGuard } from "./presentation/guards/permissions.guard"
import { RolesGuard } from "./presentation/guards/roles.guard"

/** Comptes, authentification, sessions et RBAC. */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, AccountController],
  providers: [
    IdentityConfig,
    {
      provide: SecretHasher,
      inject: [IdentityConfig],
      useFactory: (config: IdentityConfig) => new SecretHasher(config.hashKey),
    },
    {
      provide: PasswordHasher,
      inject: [IdentityConfig],
      useFactory: (config: IdentityConfig) => new PasswordHasher(config.argon2),
    },
    AccessTokenService,
    SessionRevocationStore,
    AuthRateLimiter,
    DevNotificationProvider,
    { provide: EMAIL_PROVIDER, useExisting: DevNotificationProvider },
    { provide: SMS_PROVIDER, useExisting: DevNotificationProvider },
    IdentityDatabase,
    UserRepository,
    SessionRepository,
    OtpChallengeRepository,
    PasswordResetRepository,
    RbacRepository,
    AuditRepository,
    IdentityActivity,
    AuthThrottle,
    SessionService,
    AuthService,
    PasswordService,
    VerificationService,
    ProfileService,
    AccountAdminService,
    ActorService,
    IdentityRetentionService,
    IdentityRetentionWorker,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    ActorService,
    IdentityConfig,
    AccessTokenService,
    SessionRevocationStore,
    RbacRepository,
    AccountAdminService,
    IdentityRetentionService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class IdentityModule implements OnModuleInit {
  private readonly logger = new Logger(IdentityModule.name)

  constructor(private readonly config: IdentityConfig) {}

  onModuleInit(): void {
    if (["staging", "production"].includes(this.config.appEnv)) {
      this.logger.warn(
        "Fournisseurs email/SMS de développement actifs : aucun code ne sera réellement envoyé",
      )
    }
  }
}
