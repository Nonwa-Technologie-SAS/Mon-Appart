import { Injectable } from "@nestjs/common"

import type { Db } from "../../../database/database.service"
import type { OwnershipType } from "../../../generated/prisma/enums"
import { can, type Actor } from "../../identity"
import { decideAccess, type AccessDecision } from "../domain/property-access"
import { PropertyRepository } from "../infrastructure/property.repository"

export interface AccessRequest {
  propertyId: bigint
  /** Permission fonctionnelle exigée en plus du rattachement. */
  permission: string
  /** Permission d'administration qui dispense du rattachement. */
  override: string
  relations: readonly OwnershipType[]
  publiclyVisible: boolean
}

export interface AccessResult {
  decision: AccessDecision
  relation: OwnershipType | null
}

/**
 * Point unique des décisions d'accès aux biens, partagé avec le module
 * Listing. L'acteur vient du JWT ; aucun identifiant de propriétaire n'est
 * jamais lu depuis la requête.
 */
@Injectable()
export class PropertyAccessService {
  constructor(private readonly properties: PropertyRepository) {}

  async relationOf(
    actor: Actor | null,
    propertyId: bigint,
    db?: Db,
  ): Promise<OwnershipType | null> {
    if (!actor) return null
    return this.properties.relationOf(propertyId, actor.userId, db)
  }

  async decide(
    actor: Actor,
    request: AccessRequest,
    db?: Db,
  ): Promise<AccessResult> {
    const relation = await this.relationOf(actor, request.propertyId, db)
    const decision = decideAccess({
      relation,
      allowedRelations: request.relations,
      hasPermission: can(actor, request.permission),
      hasOverride: can(actor, request.override),
      publiclyVisible: request.publiclyVisible,
    })
    return { decision, relation }
  }
}
