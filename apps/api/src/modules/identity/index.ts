export { IdentityModule } from "./identity.module"
export type { AuthenticatedUser } from "./domain/authenticated-user"
export { can, hasRole, type Actor } from "./domain/actor"
export { AuthErrorCode } from "./domain/auth-errors"
export { IdentityEvent } from "./domain/identity-events"
export type { ClientContext } from "./application/client-context"
export {
  Client,
  CurrentUser,
  OptionalAuth,
  OptionalUser,
  Permissions,
  PERMISSIONS_KEY,
  Public,
  Roles,
  type AuthenticatedRequest,
} from "./presentation/decorators/auth.decorators"
export { ErrorResponseDto } from "./presentation/dto/auth-response.dto"
export { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard"
export { PermissionsGuard } from "./presentation/guards/permissions.guard"
export { RolesGuard } from "./presentation/guards/roles.guard"
export {
  AccountAdminService,
  type AccountDecisionResult,
} from "./application/services/account-admin.service"
export {
  statusForDecision,
  type AccountDecision,
} from "./domain/account-policy"
export { parseIdentifier } from "./domain/identifier"
export { authError } from "./domain/auth-errors"
export { ActorService } from "./application/services/actor.service"
export { AccessTokenService } from "./infrastructure/tokens/access-token.service"
export { SessionRevocationStore } from "./infrastructure/tokens/session-revocation.store"
