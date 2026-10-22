import type { OwnershipType } from "../../../generated/prisma/enums"

/** Droits réels : seuls ces rattachements peuvent supprimer un bien. */
export const LEGAL_RELATIONS: readonly OwnershipType[] = [
  "SOLE",
  "JOINT",
  "USUFRUCT",
]

/** Rattachements qui permettent de gérer le bien et ses annonces. */
export const MANAGING_RELATIONS: readonly OwnershipType[] = [
  ...LEGAL_RELATIONS,
  "AGENT",
  "MANAGER",
]

export type AccessDecision =
  | "ALLOW"
  /** Accordé par une permission d'administration : à tracer dans l'audit. */
  | "ALLOW_OVERRIDE"
  | "FORBIDDEN"
  /** Le bien n'est pas visible par l'acteur : on ne révèle pas son existence. */
  | "NOT_FOUND"

export interface AccessInput {
  /** Rattachement courant de l'acteur au bien, s'il en a un. */
  relation: OwnershipType | null
  allowedRelations: readonly OwnershipType[]
  /** Permission fonctionnelle (ex. `property:update`) accordée par les rôles. */
  hasPermission: boolean
  /** Permission d'administration (ex. `property:manage`). */
  hasOverride: boolean
  /** Le bien est visible publiquement (actif, non supprimé). */
  publiclyVisible: boolean
}

/**
 * Politique d'accès : propriétaire ou mandataire rattaché ET permission du
 * rôle, ou permission d'administration. Pure, testée sans base.
 */
export function decideAccess(input: AccessInput): AccessDecision {
  if (
    input.relation !== null &&
    input.allowedRelations.includes(input.relation) &&
    input.hasPermission
  ) {
    return "ALLOW"
  }
  if (input.hasOverride) return "ALLOW_OVERRIDE"
  if (input.relation !== null || input.publiclyVisible) return "FORBIDDEN"
  return "NOT_FOUND"
}

/** Peut-on voir la vue privée (statut, adresse exacte, complétude) ? */
export function canViewPrivate(
  relation: OwnershipType | null,
  hasOverride: boolean,
): boolean {
  return (
    hasOverride || (relation !== null && MANAGING_RELATIONS.includes(relation))
  )
}
