import { UserStatus } from "../../../generated/prisma/enums"
import { AuthErrorCode } from "./auth-errors"

/**
 * Politique d'accès par statut :
 * - PENDING : connexion autorisée pour terminer la vérification ;
 * - ACTIVE : accès normal ;
 * - INACTIVE, SUSPENDED, BANNED : connexion et refresh refusés.
 */
export function loginBlockReason(status: UserStatus): AuthErrorCode | null {
  switch (status) {
    case UserStatus.BANNED:
      return AuthErrorCode.ACCOUNT_BANNED
    case UserStatus.SUSPENDED:
      return AuthErrorCode.ACCOUNT_SUSPENDED
    case UserStatus.INACTIVE:
      return AuthErrorCode.ACCOUNT_INACTIVE
    case UserStatus.PENDING:
    case UserStatus.ACTIVE:
      return null
  }
}

/** Un compte en attente devient actif dès qu'un canal de contact est vérifié. */
export function statusAfterVerification(status: UserStatus): UserStatus {
  return status === UserStatus.PENDING ? UserStatus.ACTIVE : status
}

/** Décision administrative sur un compte. */
export type AccountDecision = "SUSPEND" | "BAN" | "REACTIVATE"

const DECISION_SOURCES: Record<AccountDecision, readonly UserStatus[]> = {
  SUSPEND: [UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.INACTIVE],
  BAN: [
    UserStatus.PENDING,
    UserStatus.ACTIVE,
    UserStatus.INACTIVE,
    UserStatus.SUSPENDED,
  ],
  REACTIVATE: [UserStatus.SUSPENDED, UserStatus.BANNED],
}

/**
 * Statut visé par une décision, ou `null` si elle ne s'applique pas au statut
 * courant. Une réactivation ne contourne pas la vérification de contact : sans
 * canal vérifié, le compte redevient PENDING.
 */
export function statusForDecision(
  decision: AccountDecision,
  current: UserStatus,
  hasVerifiedContact: boolean,
): UserStatus | null {
  if (!DECISION_SOURCES[decision].includes(current)) return null
  switch (decision) {
    case "SUSPEND":
      return UserStatus.SUSPENDED
    case "BAN":
      return UserStatus.BANNED
    case "REACTIVATE":
      return hasVerifiedContact ? UserStatus.ACTIVE : UserStatus.PENDING
  }
}
