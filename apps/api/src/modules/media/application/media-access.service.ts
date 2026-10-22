import { Injectable } from "@nestjs/common"

import type { Db } from "../../../database/database.service"
import { can, type Actor } from "../../identity"
import { MANAGING_RELATIONS, PropertyAccessService } from "../../property"
import { mediaError } from "../domain/media-errors"
import type { PropertyRef } from "../infrastructure/media.repository"

export const isPropertyPublic = (property: PropertyRef) =>
  property.status === "ACTIVE" && property.deletedAt === null

export const isPropertyEditable = (property: PropertyRef) =>
  property.status !== "ARCHIVED" && property.deletedAt === null

/**
 * Décisions d'accès aux médias, déléguées à la politique des biens : gérer les
 * médias = gérer le bien (`property:update` + rattachement gestionnaire) ou
 * l'administrer (`property:manage`, dérogation auditée).
 */
@Injectable()
export class MediaAccessService {
  constructor(private readonly access: PropertyAccessService) {}

  /** Lève 404 si le bien n'est pas visible par l'acteur, 403 s'il l'est sans droit. */
  async requireManager(
    actor: Actor,
    property: PropertyRef,
    db?: Db,
  ): Promise<{ override: boolean }> {
    const { decision } = await this.access.decide(
      actor,
      {
        propertyId: property.id,
        permission: "property:update",
        override: "property:manage",
        relations: MANAGING_RELATIONS,
        publiclyVisible: isPropertyPublic(property),
      },
      db,
    )
    if (decision === "NOT_FOUND") throw mediaError("PROPERTY_NOT_FOUND")
    if (decision === "FORBIDDEN") throw mediaError("PROPERTY_ACCESS_DENIED")
    return { override: decision === "ALLOW_OVERRIDE" }
  }

  /** Vue gestionnaire (tous statuts, médias privés) sans exiger la permission d'écriture. */
  async canManage(
    actor: Actor | null,
    property: PropertyRef,
    db?: Db,
  ): Promise<boolean> {
    if (!actor) return false
    if (can(actor, "property:manage")) return true
    const relation = await this.access.relationOf(actor, property.id, db)
    return relation !== null && MANAGING_RELATIONS.includes(relation)
  }

  /**
   * Relecture des pièces (Trust) : permission dédiée, que l'administration
   * technique (`ADMIN`) ne reçoit pas par défaut.
   */
  canReviewDocuments(actor: Actor): boolean {
    return can(actor, "verification:documents")
  }
}
