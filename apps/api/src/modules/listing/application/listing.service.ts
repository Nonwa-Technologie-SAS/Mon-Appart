import { Injectable } from "@nestjs/common"

import type { RequestContext } from "../../../common/activity/activity-recorder"
import {
  DatabaseService,
  isUniqueViolation,
  type Tx,
} from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import type { ListingStatus } from "../../../generated/prisma/enums"
import { checkListingQuota } from "../../billing/entitlements"
import { can, type Actor } from "../../identity"
import {
  MANAGING_RELATIONS,
  missingForCompleteness,
  PropertyAccessService,
  propertyError,
  PropertyErrorCode,
  type AccessDecision,
} from "../../property"
import {
  loadPublicationFacts,
  missingPublicationRequirements,
} from "../../trust/publication"
import { listingError, ListingErrorCode } from "../domain/listing-errors"
import {
  auditActionForStatus,
  eventForStatus,
  LISTING_ENTITY,
  ListingAuditAction,
  ListingEvent,
} from "../domain/listing-events"
import { closingInstant, validatePrice } from "../domain/listing-price"
import {
  assertPublishable,
  assertValidExpiry,
  computeExpiry,
  needsNewPublicationDate,
} from "../domain/listing-publication"
import {
  CLOSED_STATUSES,
  LIVE_STATUSES,
  transitionActors,
} from "../domain/listing-status"
import {
  ListingRepository,
  type ListingStateRow,
} from "../infrastructure/listing.repository"
import { ListingConfig } from "../listing.config"
import { ListingActivity } from "./listing-activity"
import type {
  ChangePriceInput,
  ChangeStatusInput,
  CreateListingInput,
  StatusTransitionResult,
  UpdateListingInput,
} from "./listing-inputs"

/** Permission fonctionnelle exigée d'un gestionnaire selon le statut visé. */
const MANAGER_PERMISSION: Record<ListingStatus, string> = {
  DRAFT: "listing:update",
  PENDING_REVIEW: "listing:publish",
  PUBLISHED: "listing:publish",
  PAUSED: "listing:publish",
  SUSPENDED: "listing:update",
  EXPIRED: "listing:update",
  RENTED: "listing:update",
  SOLD: "listing:update",
  ARCHIVED: "listing:update",
}

const MODERATION_PERMISSIONS = ["listing:moderate", "listing:suspend"] as const

interface Authorized {
  state: ListingStateRow
  manager: AccessDecision
}

@Injectable()
export class ListingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly listings: ListingRepository,
    private readonly propertyAccess: PropertyAccessService,
    private readonly config: ListingConfig,
    private readonly activity: ListingActivity,
  ) {}

  async create(
    actor: Actor,
    input: CreateListingInput,
    context: RequestContext,
  ): Promise<string> {
    const property = await this.listings.findPropertyForListing(
      input.propertyId,
    )
    if (!property || property.deletedAt) {
      throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)
    }
    const { decision } = await this.propertyAccess.decide(actor, {
      propertyId: property.id,
      permission: "listing:create",
      override: "listing:manage",
      relations: MANAGING_RELATIONS,
      publiclyVisible: property.status === "ACTIVE",
    })
    if (decision === "NOT_FOUND")
      throw propertyError(PropertyErrorCode.PROPERTY_NOT_FOUND)
    if (decision === "FORBIDDEN")
      throw propertyError(PropertyErrorCode.PROPERTY_ACCESS_DENIED)
    if (property.status === "ARCHIVED") {
      throw listingError(ListingErrorCode.PROPERTY_NOT_ACTIVE)
    }
    const price = input.price
      ? validatePrice(input.listingType, input.price)
      : null
    const title = input.title ?? property.title

    const created = await this.db.transaction(async (tx) => {
      const listing = await this.listings.create(
        {
          propertyId: property.id,
          createdById: actor.userId,
          listingType: input.listingType,
          title,
          description: input.description ?? null,
        },
        price,
        tx,
      )
      await this.activity.audit(
        {
          action: ListingAuditAction.CREATED,
          actorId: actor.userId,
          entityType: LISTING_ENTITY,
          entityId: listing.publicId,
          newValues: {
            propertyId: property.publicId,
            listingType: input.listingType,
            title,
            price: price ? priceJson(price) : null,
            ...(decision === "ALLOW_OVERRIDE" ? { adminOverride: true } : {}),
          },
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: ListingEvent.CREATED,
        producer: "listing",
        aggregateType: LISTING_ENTITY,
        aggregateId: listing.publicId,
        payload: {
          listingId: listing.publicId,
          propertyId: property.publicId,
          listingType: input.listingType,
        },
        correlationId: context.requestId,
      })
      return listing
    })
    await this.activity.flush()
    this.activity.metrics.catalog.listingCreated.inc({
      listing_type: input.listingType,
    })
    this.activity.log("listing.created", context, {
      user_id: actor.publicId,
      property_id: property.publicId,
      listing_id: created.publicId,
      listing_type: input.listingType,
    })
    return created.publicId
  }

  async update(
    actor: Actor,
    publicId: string,
    input: UpdateListingInput,
    context: RequestContext,
  ): Promise<void> {
    const changed = await this.db.transaction(async (tx) => {
      const { state, manager } = await this.lockForManager(
        actor,
        publicId,
        "listing:update",
        tx,
      )
      if (CLOSED_STATUSES.includes(state.status)) {
        throw listingError(ListingErrorCode.LISTING_NOT_EDITABLE)
      }

      const data: Prisma.ListingUncheckedUpdateInput = {}
      const oldValues: Record<string, string | null> = {}
      const newValues: Record<string, string | null> = {}
      if (input.title !== undefined && input.title !== state.title) {
        data.title = input.title
        oldValues.title = state.title
        newValues.title = input.title
      }
      if (
        input.description !== undefined &&
        input.description !== state.description
      ) {
        data.description = input.description
        oldValues.description = state.description
        newValues.description = input.description
      }
      if (input.expiresAt !== undefined) {
        if (state.status !== "PUBLISHED" && state.status !== "PAUSED") {
          throw listingError(
            ListingErrorCode.INVALID_EXPIRY,
            "seulement pour une annonce publiée ou en pause",
          )
        }
        assertValidExpiry(input.expiresAt, new Date())
        data.expiresAt = input.expiresAt
        oldValues.expiresAt = state.expiresAt?.toISOString() ?? null
        newValues.expiresAt = input.expiresAt.toISOString()
      }

      const fields = Object.keys(newValues)
      if (fields.length === 0) return []
      await this.listings.update(state.id, data, tx)
      await this.activity.audit(
        {
          action: ListingAuditAction.UPDATED,
          actorId: actor.userId,
          entityType: LISTING_ENTITY,
          entityId: state.publicId,
          oldValues,
          newValues: withOverride(newValues, manager),
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: ListingEvent.UPDATED,
        producer: "listing",
        aggregateType: LISTING_ENTITY,
        aggregateId: state.publicId,
        payload: { listingId: state.publicId, changedFields: fields },
        correlationId: context.requestId,
      })
      return fields
    })

    if (changed.length === 0) return
    await this.activity.flush()
    this.activity.log("listing.updated", context, {
      user_id: actor.publicId,
      listing_id: publicId,
      changed_fields: changed.join(","),
    })
  }

  /**
   * Ferme le prix courant et ouvre le nouveau dans la même transaction, sous
   * verrou de l'annonce : deux changements concurrents s'exécutent l'un après
   * l'autre et l'historique reste continu, avec un seul prix courant.
   */
  async changePrice(
    actor: Actor,
    publicId: string,
    input: ChangePriceInput,
    context: RequestContext,
  ): Promise<void> {
    const change = await this.db.transaction(async (tx) => {
      const { state, manager } = await this.lockForManager(
        actor,
        publicId,
        "listing:update",
        tx,
      )
      if (CLOSED_STATUSES.includes(state.status)) {
        throw listingError(ListingErrorCode.LISTING_NOT_EDITABLE)
      }
      const next = validatePrice(state.listingType, input)
      const current = state.prices[0] ?? null
      if (
        current &&
        Number(current.amount.toString()) === next.amount &&
        current.period === next.period &&
        current.currency === next.currency
      ) {
        return null
      }

      const now = new Date()
      const validFrom = current ? closingInstant(current.validFrom, now) : now
      if (current) await this.listings.closePrice(state.id, validFrom, tx)
      await this.listings.insertPrice(state.id, next, validFrom, tx)

      const before = current
        ? {
            amount: current.amount.toString(),
            currency: current.currency,
            period: current.period,
          }
        : null
      await this.activity.audit(
        {
          action: ListingAuditAction.PRICE_CHANGED,
          actorId: actor.userId,
          entityType: LISTING_ENTITY,
          entityId: state.publicId,
          oldValues: before ?? undefined,
          newValues: withOverride(
            { ...priceJson(next), reason: input.reason ?? null },
            manager,
          ),
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: ListingEvent.PRICE_CHANGED,
        producer: "listing",
        aggregateType: LISTING_ENTITY,
        aggregateId: state.publicId,
        payload: {
          listingId: state.publicId,
          oldAmount: before?.amount ?? null,
          newAmount: priceJson(next).amount,
          currency: next.currency,
          period: next.period,
        },
        correlationId: context.requestId,
      })
      return { before, after: priceJson(next) }
    })

    if (!change) return
    await this.activity.flush()
    this.activity.metrics.catalog.listingPriceChanged.inc()
    this.activity.log("listing.price_changed", context, {
      user_id: actor.publicId,
      listing_id: publicId,
      period: change.after.period,
    })
  }

  /** Publication par le gestionnaire ; passe par la revue si la modération est active. */
  publish(
    actor: Actor,
    publicId: string,
    options: { expiresAt?: Date },
    context: RequestContext,
  ): Promise<ListingStatus> {
    return this.transition(
      actor,
      publicId,
      { status: "PUBLISHED", ...options },
      context,
      {
        viaPublish: true,
      },
    )
  }

  /**
   * `inTransaction` s'exécute dans la transaction du changement, après son
   * audit : notifications et notes du back-office sont validées avec lui.
   */
  changeStatus(
    actor: Actor,
    publicId: string,
    input: ChangeStatusInput,
    context: RequestContext,
    inTransaction?: (tx: Tx, result: StatusTransitionResult) => Promise<void>,
  ): Promise<ListingStatus> {
    return this.transition(actor, publicId, input, context, {
      viaPublish: false,
      ...(inTransaction ? { inTransaction } : {}),
    })
  }

  /** Suppression logique : archive (historique conservé) puis masque l'annonce. */
  async remove(
    actor: Actor,
    publicId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { state, manager } = await this.lockForManager(
        actor,
        publicId,
        "listing:delete",
        tx,
      )
      if (state.status !== "ARCHIVED") {
        await this.listings.addHistory(
          {
            listingId: state.id,
            oldStatus: state.status,
            newStatus: "ARCHIVED",
            changedById: actor.userId,
            reason: "deleted",
          },
          tx,
        )
      }
      await this.listings.update(
        state.id,
        { status: "ARCHIVED", deletedAt: new Date() },
        tx,
      )
      await this.activity.audit(
        {
          action: ListingAuditAction.DELETED,
          actorId: actor.userId,
          entityType: LISTING_ENTITY,
          entityId: state.publicId,
          oldValues: { status: state.status },
          newValues: withOverride(
            { status: "ARCHIVED", deleted: true },
            manager,
          ),
        },
        context,
        tx,
      )
      await this.activity.enqueue(tx, {
        name: ListingEvent.DELETED,
        producer: "listing",
        aggregateType: LISTING_ENTITY,
        aggregateId: state.publicId,
        payload: {
          listingId: state.publicId,
          previousStatus: state.status,
        },
        correlationId: context.requestId,
      })
      return state.status
    })

    await this.activity.flush()
    this.activity.log("listing.deleted", context, {
      user_id: actor.publicId,
      listing_id: publicId,
    })
  }

  private async transition(
    actor: Actor,
    publicId: string,
    input: ChangeStatusInput,
    context: RequestContext,
    options: {
      viaPublish: boolean
      inTransaction?: (tx: Tx, result: StatusTransitionResult) => Promise<void>
    },
  ): Promise<ListingStatus> {
    const result = await this.db.transaction(async (tx) => {
      const { state, manager } = await this.lockForTransition(
        actor,
        publicId,
        input.status,
        tx,
      )
      if (input.expectedStatus && input.expectedStatus !== state.status) {
        throw listingError(ListingErrorCode.LISTING_STATUS_CHANGED)
      }

      let target = input.status
      if (
        options.viaPublish &&
        this.config.moderationRequired &&
        (state.status === "DRAFT" || state.status === "EXPIRED")
      ) {
        target = "PENDING_REVIEW"
      }

      const actors = transitionActors(state.status, target, state.listingType)
      const managerAllowed = manager === "ALLOW" || manager === "ALLOW_OVERRIDE"
      const allowed = actors.some(
        (entry) =>
          (entry.kind === "manager" && managerAllowed) ||
          (entry.kind === "moderator" && can(actor, entry.permission)),
      )
      if (!allowed) throw listingError(ListingErrorCode.LISTING_ACCESS_DENIED)

      const data: Prisma.ListingUncheckedUpdateInput = { status: target }
      if (target === "PUBLISHED" || target === "PENDING_REVIEW") {
        assertPublishable({
          listingTitle: state.title,
          hasCurrentPrice: state.prices.length > 0,
          propertyStatus: state.property.status,
          propertyDeleted: state.property.deletedAt !== null,
          propertyMissing: missingForCompleteness(
            propertyCharacteristics(state),
          ),
        })
        await this.assertPublicationRequirements(state, tx)
      } else if (input.expiresAt) {
        throw listingError(
          ListingErrorCode.INVALID_EXPIRY,
          "seulement à la publication",
        )
      }
      if (
        manager === "ALLOW" &&
        !LIVE_STATUSES.includes(state.status) &&
        LIVE_STATUSES.includes(target)
      ) {
        await this.assertListingQuota(state, tx)
      }
      if (target === "PUBLISHED") {
        const now = new Date()
        const publishedAt = needsNewPublicationDate(
          state.status,
          state.publishedAt,
        )
          ? now
          : (state.publishedAt ?? now)
        data.publishedAt = publishedAt
        data.expiresAt = computeExpiry({
          now,
          ...(input.expiresAt ? { requested: input.expiresAt } : {}),
          current: needsNewPublicationDate(state.status, state.publishedAt)
            ? null
            : state.expiresAt,
          defaultDays: this.config.defaultDurationDays,
        })
      }

      try {
        await this.listings.update(state.id, data, tx)
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw listingError(ListingErrorCode.LISTING_ALREADY_LIVE_FOR_TYPE)
        }
        throw error
      }
      await this.listings.addHistory(
        {
          listingId: state.id,
          oldStatus: state.status,
          newStatus: target,
          changedById: actor.userId,
          reason: input.reason ?? null,
        },
        tx,
      )
      await this.activity.audit(
        {
          action: auditActionForStatus(target),
          actorId: actor.userId,
          entityType: LISTING_ENTITY,
          entityId: state.publicId,
          oldValues: { status: state.status },
          newValues: withOverride(
            { status: target, reason: input.reason ?? null },
            manager,
          ),
        },
        context,
        tx,
      )
      await options.inTransaction?.(tx, {
        listingId: state.id,
        publicId: state.publicId,
        createdById: state.createdById,
        title: state.title,
        from: state.status,
        to: target,
      })
      await this.activity.enqueue(tx, {
        name: eventForStatus(target),
        producer: "listing",
        aggregateType: LISTING_ENTITY,
        aggregateId: state.publicId,
        payload: {
          listingId: state.publicId,
          propertyId: state.property.publicId,
          from: state.status,
          to: target,
        },
        correlationId: context.requestId,
      })
      return {
        from: state.status,
        to: target,
        propertyId: state.property.publicId,
      }
    })

    await this.activity.flush()
    this.activity.metrics.catalog.listingStatusChanged.inc({ to: result.to })
    this.activity.log(`listing.${result.to.toLowerCase()}`, context, {
      user_id: actor.publicId,
      property_id: result.propertyId,
      listing_id: publicId,
      from: result.from,
    })
    return result.to
  }

  /**
   * Vérifications exigées par `LISTING_PUBLICATION_REQUIREMENTS` (vide par
   * défaut) : identité du créateur de l'annonce, droit de publier le bien.
   */
  private async assertPublicationRequirements(
    state: ListingStateRow,
    tx: Tx,
  ): Promise<void> {
    const required = this.config.publicationRequirements
    if (required.length === 0) return
    const facts = await loadPublicationFacts(
      tx,
      { publisherId: state.createdById, propertyId: state.propertyId },
      new Date(),
    )
    const missing = missingPublicationRequirements(required, facts)
    if (missing.length > 0) {
      throw listingError(
        ListingErrorCode.VERIFICATION_REQUIRED,
        missing.join(", "),
      )
    }
  }

  /**
   * Quota d'annonces actives du publieur (plan ou abonnement), sous verrou
   * par publieur. Ne s'applique pas aux décisions de modération ni aux
   * interventions administratives (`listing:manage`).
   */
  private async assertListingQuota(
    state: ListingStateRow,
    tx: Tx,
  ): Promise<void> {
    const quota = await checkListingQuota(
      tx,
      state.createdById,
      new Date(),
      this.config.billingGraceDays,
    )
    if (!quota.allowed) {
      this.activity.metrics.billing.quotaRejections.inc()
      throw listingError(
        ListingErrorCode.LISTING_QUOTA_EXCEEDED,
        `${quota.live}/${quota.limit}`,
      )
    }
  }

  private async lockState(publicId: string, tx: Tx): Promise<ListingStateRow> {
    const id = await this.listings.lockByPublicId(publicId, tx)
    const state = id === null ? null : await this.listings.findState(id, tx)
    if (!state || state.deletedAt)
      throw listingError(ListingErrorCode.LISTING_NOT_FOUND)
    return state
  }

  private managerDecision(
    actor: Actor,
    state: ListingStateRow,
    permission: string,
    tx: Tx,
  ): Promise<AccessDecision> {
    return this.propertyAccess
      .decide(
        actor,
        {
          propertyId: state.propertyId,
          permission,
          override: "listing:manage",
          relations: MANAGING_RELATIONS,
          publiclyVisible: isPublic(state),
        },
        tx,
      )
      .then((result) => result.decision)
  }

  /** Écritures du gestionnaire (contenu, prix, suppression). */
  private async lockForManager(
    actor: Actor,
    publicId: string,
    permission: string,
    tx: Tx,
  ): Promise<Authorized> {
    const state = await this.lockState(publicId, tx)
    const manager = await this.managerDecision(actor, state, permission, tx)
    if (manager === "NOT_FOUND")
      throw listingError(ListingErrorCode.LISTING_NOT_FOUND)
    if (manager === "FORBIDDEN")
      throw listingError(ListingErrorCode.LISTING_ACCESS_DENIED)
    return { state, manager }
  }

  /**
   * Changement de statut : gestionnaire ou modérateur. Un acteur sans aucun
   * de ces droits reçoit 404 si l'annonce n'est pas publique, 403 sinon.
   */
  private async lockForTransition(
    actor: Actor,
    publicId: string,
    target: ListingStatus,
    tx: Tx,
  ): Promise<Authorized> {
    const state = await this.lockState(publicId, tx)
    const manager = await this.managerDecision(
      actor,
      state,
      MANAGER_PERMISSION[target],
      tx,
    )
    const moderator = MODERATION_PERMISSIONS.some((permission) =>
      can(actor, permission),
    )
    if (!moderator) {
      if (manager === "NOT_FOUND")
        throw listingError(ListingErrorCode.LISTING_NOT_FOUND)
      if (manager === "FORBIDDEN")
        throw listingError(ListingErrorCode.LISTING_ACCESS_DENIED)
    }
    return { state, manager }
  }
}

function isPublic(state: ListingStateRow): boolean {
  return (
    state.status === "PUBLISHED" &&
    state.property.status === "ACTIVE" &&
    state.property.deletedAt === null
  )
}

function propertyCharacteristics(state: ListingStateRow) {
  const property = state.property
  const num = (value: { toString(): string } | null) =>
    value === null ? null : Number(value.toString())
  return {
    category: property.propertyType.category,
    title: property.title,
    surface: num(property.surface),
    landSurface: num(property.landSurface),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    rooms: property.rooms,
    floor: property.floor,
    totalFloors: property.totalFloors,
    latitude: num(property.latitude),
    longitude: num(property.longitude),
    attributes: (property.attributes ?? {}) as Record<string, unknown>,
  }
}

function priceJson(price: {
  amount: number
  currency: string
  period: string
}) {
  return {
    amount: String(price.amount),
    currency: price.currency,
    period: price.period,
  }
}

function withOverride<T extends Record<string, unknown>>(
  values: T,
  decision: AccessDecision,
): Prisma.InputJsonValue {
  return (
    decision === "ALLOW_OVERRIDE" ? { ...values, adminOverride: true } : values
  ) as Prisma.InputJsonValue
}
