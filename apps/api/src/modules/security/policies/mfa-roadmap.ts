/**
 * Feuille de route MFA — **non activée**.
 *
 * Priorité prévue : comptes staff (`ADMIN`, `SUPER_ADMIN`, `TRUST_OFFICER`,
 * `MODERATOR`) puis propriétaires / agences à volume élevé.
 *
 * Méthode cible : TOTP (RFC 6238) + codes de récupération à usage unique
 * (hachés comme les OTP Identity). Pas de SMS comme second facteur principal.
 *
 * Ne pas exposer d'endpoint MFA tant que le parcours complet (enrôlement,
 * challenge login, récupération, révocation) n'est pas testé.
 */
export const MFA_STATUS = "planned" as const

export const MFA_PRIORITY_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "TRUST_OFFICER",
  "MODERATOR",
] as const
