import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import { DatabaseService, type Tx } from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type { OwnershipType } from "../../../generated/prisma/enums"
import { can, hasRole, type Actor } from "../../identity"
import { LEGAL_RELATIONS, MANAGING_RELATIONS } from "../domain/property-access"
import { propertyError, PropertyErrorCode } from "../domain/property-errors"
import {
  PROPERTY_ENTITY,
  PropertyAuditAction,
  PropertyEvent,
} from "../domain/property-events"
import {
  canTransitionProperty,
  isWithdrawal,
  missingForCompleteness,
  validateCharacteristics,
  type PropertyCharacteristics,
} from "../domain/property-rules"
import { CatalogRepository } from "../infrastructure/catalog.repository"
import {
  PropertyRepository,
  type PropertyStateRow,
} from "../infrastructure/property.repository"
import { PropertyAccessService } from "./property-access.service"
import { PropertyActivity } from "./property-activity"
import type {
  CreatePropertyInput,
  PropertyFields,
  UpdatePropertyInput,
} from "./property-inputs"

type Intent = "update" | "delete"

const INTENTS: Record<
  Intent,
  { permission: string; relations: readonly OwnershipType[] }
> = {
  update: { permission: "property:update", relations: MANAGING_RELATIONS },
  delete: { permission: "property:delete", relations: LEGAL_RELATIONS },
}

/** Rattachements de représentation, réservés aux professionnels. */
const REPRESENTATION: readonly OwnershipType[] = ["AGENT", "MANAGER"]

const SCALAR_FIELDS = [
  "title",
  "description",
  "surface",
  "landSurface",
  "bedrooms",
  "bathrooms",
  "rooms",
  "floor",
  "totalFloors",
  "yearBuilt",
  "address",
  "latitude",
  "longitude",
  "locationVisibility",
] as const satisfies ReadonlyArray<keyof PropertyFields>

@Injectable()
export class PropertyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly properties: PropertyRepository,
    private readonly catalog: CatalogRepository,
    private readonly access: PropertyAccessService,
    private readonly activity: PropertyActivity,
  ) {}

  async create(
    actor: Actor,
    input: CreatePropertyInput,
    context: RequestContext,
  ): Promise<string> {
    const type = await this.catalog.propertyType(input.propertyType)
    if (!type?.isActive)
      throw propertyError(PropertyErrorCode.INVALID_PROPERTY_TYPE)
    const neighborhood = await this.catalog.neighborhood(
      input.commune,
      input.neighborhood,
    )
    if (!neighborhood) {
      throw propertyError(
        PropertyErrorCode.INVALID_LOCATION,
        "quartier inconnu",
      )
    }
    const ownershipType = this.ownershipTypeFor(actor, input.ownershipType)
    const amenities = await this.resolveAmenities(input.amenities ?? [])

    const characteristics = toCharacteristics(type.category, input)
    validateCharacteristics(characteristics)

    const created = await this.db.transaction(async (tx) => {
      const property = await this.properties.create(
        {
          propertyTypeId: type.id,
          neighborhoodId: neighborhood.id,
          title: input.title,
          description: input.description ?? null,
          surface: input.surface ?? null,
          landSurface: input.landSurface ?? null,
          bedrooms: input.bedrooms ?? null,
          bathrooms: input.bathrooms ?? null,
          rooms: input.rooms ?? null,
          floor: input.floor ?? null,
          totalFloors: input.totalFloors ?? null,
          yearBuilt: input.yearBuilt ?? null,
          address: input.address ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          ...(input.locationVisibility
            ? { locationVisibility: input.locationVisibility }
            : {}),
          attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
          status: "DRAFT",
        },
        { userId: actor.userId, ownershipType },
        amenities.map((amenity) => amenity.id),
        tx,
      )
      await this.activity.audit(
        {
          action: PropertyAuditAction.CREATED,
          actorId: actor.userId,
          entityType: PROPERTY_ENTITY,
          entityId: property.publicId,
          newValues: {
            propertyType: type.code,
            commune: neighborhood.communeCode,
            neighborhood: neighborhood.code,
            title: input.title,
            amenities: amenities.map((amenity) => amenity.code),
          },
        },
        context,
        tx,
      )
      await this.activity.audit(
        {
          action: PropertyAuditAction.OWNERSHIP_CHANGED,
          actorId: actor.userId,
          entityType: PROPERTY_ENTITY,
          entityId: property.publicId,
          newValues: { userId: actor.publicId, ownershipType },
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: PropertyEvent.CREATED,
        producer: "property",
        aggregateType: PROPERTY_ENTITY,
        aggregateId: property.publicId,
        payload: {
          propertyId: property.publicId,
          propertyType: type.code,
          commune: neighborhood.communeCode,
          neighborhood: neighborhood.code,
        },
        correlationId: context.requestId,
      })
      return property
    })
    await this.activity.flush()
    this.activity.metrics.catalog.propertyCreated.inc()
    this.activity.log("property.created", context, {
      user_id: actor.publicId,
      property_id: created.publicId,
      property_type: type.code,
    })
    return created.publicId
  }

  async update(
    actor: Actor,
    publicId: string,
    input: UpdatePropertyInput,
    context: RequestContext,
  ): Promise<void> {
    const changed = await this.db.transaction(async (tx) => {
      const { state, override } = await this.lockAndAuthorize(
        actor,
        publicId,
        "update",
        tx,
      )

      const data: Prisma.PropertyUncheckedUpdateInput = {}
      const oldValues: Record<string, Prisma.InputJsonValue | null> = {}
      const newValues: Record<string, Prisma.InputJsonValue | null> = {}
      const record = (field: string, before: unknown, after: unknown) => {
        oldValues[field] = jsonValue(before)
        newValues[field] = jsonValue(after)
      }

      let category = state.propertyType.category
      if (
        input.propertyType !== undefined &&
        input.propertyType !== state.propertyType.code
      ) {
        const type = await this.catalog.propertyType(input.propertyType)
        if (!type?.isActive) {
          throw propertyError(PropertyErrorCode.INVALID_PROPERTY_TYPE)
        }
        data.propertyTypeId = type.id
        category = type.category
        record("propertyType", state.propertyType.code, type.code)
      }

      if (input.commune !== undefined || input.neighborhood !== undefined) {
        if (input.commune === undefined || input.neighborhood === undefined) {
          throw propertyError(
            PropertyErrorCode.INVALID_LOCATION,
            "commune et quartier vont ensemble",
          )
        }
        const neighborhood = await this.catalog.neighborhood(
          input.commune,
          input.neighborhood,
        )
        if (!neighborhood) {
          throw propertyError(
            PropertyErrorCode.INVALID_LOCATION,
            "quartier inconnu",
          )
        }
        if (neighborhood.id !== state.neighborhoodId) {
          data.neighborhoodId = neighborhood.id
          record("neighborhood", state.neighborhoodId, neighborhood.code)
        }
      }

      for (const field of SCALAR_FIELDS) {
        const next = input[field]
        if (next === undefined) continue
        const current = plain(state[field])
        if (current === next) continue
        ;(data as Record<string, unknown>)[field] = next
        record(field, current, next)
      }

      if (input.attributes !== undefined) {
        const current = state.attributes as Record<string, unknown>
        if (JSON.stringify(current) !== JSON.stringify(input.attributes)) {
          data.attributes = input.attributes as Prisma.InputJsonValue
          record("attributes", current, input.attributes)
        }
      }

      const merged = mergeCharacteristics(state, category, input)
      validateCharacteristics(merged)

      if (input.status !== undefined && input.status !== state.status) {
        await this.checkStatusChange(state, input.status, merged, tx)
        data.status = input.status
        record("status", state.status, input.status)
      }

      const changedFields = Object.keys(newValues)
      if (changedFields.length === 0) return []

      await this.properties.update(state.id, data, tx)
      await this.activity.audit(
        {
          action: PropertyAuditAction.UPDATED,
          actorId: actor.userId,
          entityType: PROPERTY_ENTITY,
          entityId: state.publicId,
          oldValues,
          newValues: override
            ? { ...newValues, adminOverride: true }
            : newValues,
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: PropertyEvent.UPDATED,
        producer: "property",
        aggregateType: PROPERTY_ENTITY,
        aggregateId: state.publicId,
        payload: { propertyId: state.publicId, changedFields },
        correlationId: context.requestId,
      })
      return changedFields
    })

    if (changed.length === 0) return
    await this.activity.flush()
    this.activity.log("property.updated", context, {
      user_id: actor.publicId,
      property_id: publicId,
      changed_fields: changed.join(","),
    })
  }

  async remove(
    actor: Actor,
    publicId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { state, override } = await this.lockAndAuthorize(
        actor,
        publicId,
        "delete",
        tx,
      )
      if ((await this.properties.countLiveListings(state.id, tx)) > 0) {
        throw propertyError(PropertyErrorCode.PROPERTY_HAS_ACTIVE_LISTINGS)
      }
      const deletedListings = await this.properties.softDelete(
        state.id,
        new Date(),
        tx,
      )
      await this.activity.audit(
        {
          action: PropertyAuditAction.DELETED,
          actorId: actor.userId,
          entityType: PROPERTY_ENTITY,
          entityId: state.publicId,
          oldValues: { status: state.status },
          newValues: {
            deleted: true,
            deletedListings,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: PropertyEvent.DELETED,
        producer: "property",
        aggregateType: PROPERTY_ENTITY,
        aggregateId: state.publicId,
        payload: { propertyId: state.publicId },
        correlationId: context.requestId,
      })
    })

    await this.activity.flush()
    this.activity.metrics.catalog.propertyDeleted.inc()
    this.activity.log("property.deleted", context, {
      user_id: actor.publicId,
      property_id: publicId,
    })
  }

  /** Remplace la liste d'équipements : diff en transaction, sans doublon. */
  async replaceAmenities(
    actor: Actor,
    publicId: string,
    codes: readonly string[],
    context: RequestContext,
  ): Promise<void> {
    const wanted = await this.resolveAmenities(codes)
    const changes = await this.db.transaction(async (tx) => {
      const { state, override } = await this.lockAndAuthorize(
        actor,
        publicId,
        "update",
        tx,
      )
      const current = new Set(await this.properties.amenityIds(state.id, tx))
      const target = new Map(
        wanted.map((amenity) => [amenity.id, amenity.code]),
      )
      const added = [...target.keys()].filter((id) => !current.has(id))
      const removed = [...current].filter((id) => !target.has(id))
      if (added.length === 0 && removed.length === 0) return null

      await this.properties.replaceAmenities(state.id, added, removed, tx)
      const all = await this.catalog.amenities()
      const codeOf = new Map(all.map((amenity) => [amenity.id, amenity.code]))
      const diff = {
        added: added.map((id) => codeOf.get(id) ?? String(id)),
        removed: removed.map((id) => codeOf.get(id) ?? String(id)),
      }
      await this.activity.audit(
        {
          action: PropertyAuditAction.UPDATED,
          actorId: actor.userId,
          entityType: PROPERTY_ENTITY,
          entityId: state.publicId,
          newValues: {
            amenities: diff,
            ...(override ? { adminOverride: true } : {}),
          },
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: PropertyEvent.UPDATED,
        producer: "property",
        aggregateType: PROPERTY_ENTITY,
        aggregateId: state.publicId,
        payload: { propertyId: state.publicId, changedFields: ["amenities"] },
        correlationId: context.requestId,
      })
      return diff
    })

    if (!changes) return
    await this.activity.flush()
    this.activity.log("property.amenities_updated", context, {
      user_id: actor.publicId,
      property_id: publicId,
      added: changes.added.length,
      removed: changes.removed.length,
    })
  }

  private async lockAndAuthorize(
    actor: Actor,
    publicId: string,
    intent: Intent,
    tx: Tx,
  ): Promise<{ state: PropertyStateRow; override: boolean }> {
    const id = await this.properties.lockByPublicId(publicId, tx)
    const state = id === null ? null : await this.properties.findState(id, tx)
    if (!state) throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)

    const rules = INTENTS[intent]
    const { decision } = await this.access.decide(
      actor,
      {
        propertyId: state.id,
        permission: rules.permission,
        override: "property:manage",
        relations: rules.relations,
        publiclyVisible: state.status === "ACTIVE" && state.deletedAt === null,
      },
      tx,
    )
    if (decision === "NOT_FOUND") {
      throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)
    }
    if (decision === "FORBIDDEN") {
      throw propertyError(PropertyErrorCode.PROPERTY_ACCESS_DENIED)
    }
    if (state.deletedAt) {
      throw propertyError(PropertyErrorCode.PROPERTY_ALREADY_DELETED)
    }
    return { state, override: decision === "ALLOW_OVERRIDE" }
  }

  private async checkStatusChange(
    state: PropertyStateRow,
    next: NonNullable<UpdatePropertyInput["status"]>,
    merged: PropertyCharacteristics,
    tx: Tx,
  ): Promise<void> {
    if (!canTransitionProperty(state.status, next)) {
      throw propertyError(
        PropertyErrorCode.INVALID_PROPERTY_STATUS_TRANSITION,
        `${state.status} → ${next}`,
      )
    }
    if (next === "ACTIVE") {
      const missing = missingForCompleteness(merged)
      if (missing.length > 0) {
        throw propertyError(
          PropertyErrorCode.PROPERTY_INCOMPLETE,
          missing.join(", "),
        )
      }
    }
    if (
      isWithdrawal(next) &&
      (await this.properties.countLiveListings(state.id, tx)) > 0
    ) {
      throw propertyError(PropertyErrorCode.PROPERTY_HAS_ACTIVE_LISTINGS)
    }
  }

  private ownershipTypeFor(
    actor: Actor,
    requested: OwnershipType | undefined,
  ): OwnershipType {
    const professional = hasRole(actor, "AGENT") || hasRole(actor, "AGENCY")
    const ownershipType =
      requested ?? (professional && !hasRole(actor, "OWNER") ? "AGENT" : "SOLE")
    if (
      REPRESENTATION.includes(ownershipType) &&
      !professional &&
      !can(actor, "property:manage")
    ) {
      throw propertyError(PropertyErrorCode.INVALID_OWNERSHIP_TYPE)
    }
    return ownershipType
  }

  private async resolveAmenities(codes: readonly string[]) {
    const unique = [...new Set(codes)]
    const amenities = await this.catalog.amenitiesByCodes(unique)
    if (!amenities) throw propertyError(PropertyErrorCode.INVALID_AMENITY)
    return amenities
  }
}

function toCharacteristics(
  category: PropertyCharacteristics["category"],
  input: PropertyFields & { title: string },
): PropertyCharacteristics {
  return {
    category,
    title: input.title,
    surface: input.surface ?? null,
    landSurface: input.landSurface ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    totalFloors: input.totalFloors ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    attributes: input.attributes ?? {},
  }
}

export function stateCharacteristics(
  state: PropertyStateRow,
): PropertyCharacteristics {
  return {
    category: state.propertyType.category,
    title: state.title,
    surface: toNumber(state.surface),
    landSurface: toNumber(state.landSurface),
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    rooms: state.rooms,
    floor: state.floor,
    totalFloors: state.totalFloors,
    latitude: toNumber(state.latitude),
    longitude: toNumber(state.longitude),
    attributes: (state.attributes ?? {}) as Record<string, unknown>,
  }
}

function mergeCharacteristics(
  state: PropertyStateRow,
  category: PropertyCharacteristics["category"],
  input: PropertyFields,
): PropertyCharacteristics {
  const current = stateCharacteristics(state)
  const pick = <K extends keyof PropertyCharacteristics>(
    key: K,
    next: PropertyCharacteristics[K] | undefined,
  ): PropertyCharacteristics[K] => (next === undefined ? current[key] : next)
  return {
    category,
    title: pick("title", input.title),
    surface: pick("surface", input.surface),
    landSurface: pick("landSurface", input.landSurface),
    bedrooms: pick("bedrooms", input.bedrooms),
    bathrooms: pick("bathrooms", input.bathrooms),
    rooms: pick("rooms", input.rooms),
    floor: pick("floor", input.floor),
    totalFloors: pick("totalFloors", input.totalFloors),
    latitude: pick("latitude", input.latitude),
    longitude: pick("longitude", input.longitude),
    attributes: pick("attributes", input.attributes),
  }
}

function toNumber(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString())
}

/** Décimaux Prisma ramenés à des nombres pour comparer avec l'entrée. */
function plain(value: unknown): unknown {
  if (value !== null && typeof value === "object" && "toFixed" in value) {
    return Number(String(value))
  }
  return value
}

function jsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "object" && "toFixed" in value) return String(value)
  return value as Prisma.InputJsonValue
}
