import { Injectable, Logger } from "@nestjs/common"
import {
  LISTING_TYPES,
  RECOMMENDATION_REASON_LABELS,
  type ListingType,
  type RecommendationContext,
  type RecommendationFeedbackType,
  type RecommendationResponse,
} from "@mon-appart/types"
import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"

import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { AppException } from "../../../common/http/app-exception"
import { MetricsService } from "../../../observability/metrics.service"
import {
  ActorService,
  type Actor,
  type AuthenticatedUser,
} from "../../identity"
import { CatalogRepository } from "../../property"
import {
  ListingCandidateSource,
  SearchHydrator,
  type CandidateCriteria,
  type ListingCandidate,
} from "../../search"
import {
  budgetCeiling,
  DEFAULT_PRICE_PERIOD,
  SIMILAR_PRICE_BAND,
} from "../domain/budget"
import {
  decodeRecommendationCursor,
  encodeRecommendationCursor,
  fingerprint,
} from "../domain/recommendation-cursor"
import {
  recommendationError,
  RecommendationErrorCode,
} from "../domain/recommendation-errors"
import {
  RecommendationEvent,
  type RecommendationFeedbackPayload,
  type RecommendationServedPayload,
} from "../domain/recommendation-events"
import {
  recommendationLevel,
  type BehaviorSignals,
  type DeclaredPreferences,
  type ScoringContext,
} from "../domain/recommendation-input"
import {
  BehaviorRepository,
  type UserExclusions,
} from "../infrastructure/behavior.repository"
import {
  RecommendationCache,
  type RankedList,
} from "../infrastructure/recommendation-cache"
import {
  isUuid,
  RecommendationRepository,
} from "../infrastructure/recommendation.repository"
import { RecommendationConfig } from "../recommendation.config"
import { BehaviorProfileService } from "./behavior-profile.service"
import { PreferenceService } from "./preference.service"
import { RecommendationRanker } from "./recommendation-ranker"

/** Paramètres d'URL bruts de `GET /recommendations`. */
export interface RawRecommendationParams {
  listingType?: string
  propertyType?: string
  city?: string
  limit?: string
  cursor?: string
}

export interface RequestContext {
  user: AuthenticatedUser | undefined
  requestId: string | null
}

interface HardFilters {
  listingTypes: ListingType[]
  propertyTypeIds: number[]
  cityIds: number[] | null
}

/** En dessous, la liste d'annonces similaires est élargie (sans la fourchette de prix). */
const SIMILAR_MIN_RESULTS = 5
const BOOST_FROM_BEHAVIOR = 5
const NO_EXCLUSIONS: UserExclusions = {
  propertyIds: [],
  listingIds: [],
  viewedPropertyIds: new Set(),
}

const invalidQuery = (detail: string) =>
  recommendationError(
    RecommendationErrorCode.INVALID_RECOMMENDATION_QUERY,
    detail,
  )

/**
 * Pipeline : filtres stricts → pool de candidats (une requête) → classement
 * (règles ou moteur distant) → diversification → cache → page hydratée par
 * la recherche (visibilité revérifiée) → persistance de la page servie.
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name)

  constructor(
    private readonly config: RecommendationConfig,
    private readonly candidates: ListingCandidateSource,
    private readonly hydrator: SearchHydrator,
    private readonly catalog: CatalogRepository,
    private readonly preferences: PreferenceService,
    private readonly behavior: BehaviorProfileService,
    private readonly behaviorRepository: BehaviorRepository,
    private readonly ranker: RecommendationRanker,
    private readonly cache: RecommendationCache,
    private readonly repository: RecommendationRepository,
    private readonly actors: ActorService,
    private readonly metrics: MetricsService,
    private readonly events: DomainEventPublisher,
  ) {}

  async personalized(
    params: RawRecommendationParams,
    request: RequestContext,
  ): Promise<RecommendationResponse> {
    const limit = this.parseLimit(params.limit)
    const filters = await this.parseFilters(params)
    const actor = await this.actors.resolveOptional(request.user)
    const hash = fingerprint({
      c: "P",
      owner: actor?.publicId ?? null,
      lt: filters.listingTypes,
      pt: filters.propertyTypeIds,
      city: filters.cityIds,
    })
    return this.serve(
      "PERSONALIZED",
      actor,
      hash,
      limit,
      params.cursor,
      request,
      (asOf) => this.computePersonalized(actor, filters, asOf),
    )
  }

  async similar(
    listingPublicId: string,
    params: Pick<RawRecommendationParams, "limit" | "cursor">,
    request: RequestContext,
  ): Promise<RecommendationResponse> {
    const limit = this.parseLimit(params.limit)
    if (!isUuid(listingPublicId)) {
      throw recommendationError(RecommendationErrorCode.LISTING_NOT_FOUND)
    }
    const actor = await this.actors.resolveOptional(request.user)
    const hash = fingerprint({
      c: "S",
      owner: actor?.publicId ?? null,
      ref: listingPublicId.toLowerCase(),
    })
    return this.serve(
      "SIMILAR",
      actor,
      hash,
      limit,
      params.cursor,
      request,
      (asOf) => this.computeSimilar(actor, listingPublicId, asOf),
    )
  }

  /** Retour sur une recommandation servie à cet utilisateur ; sinon 404. */
  async feedback(
    user: AuthenticatedUser,
    recommendationPublicId: string,
    type: RecommendationFeedbackType,
  ): Promise<void> {
    const actor = await this.actors.resolve(user)
    const recommendation = await this.repository.findOwned(
      recommendationPublicId,
      actor.userId,
    )
    if (!recommendation) {
      throw recommendationError(
        RecommendationErrorCode.RECOMMENDATION_NOT_FOUND,
      )
    }
    const created = await this.repository.addFeedback(recommendation.id, type)
    if (!created) return
    this.metrics.recommendation.feedback.inc({ type })
    this.events.publish({
      id: randomUUID(),
      name: RecommendationEvent.FEEDBACK,
      occurredAt: new Date().toISOString(),
      aggregateId: recommendationPublicId,
      payload: {
        recommendationId: recommendationPublicId,
        type,
      } satisfies RecommendationFeedbackPayload,
    })
    // Un affichage ne change pas les goûts : seuls les autres retours invalident.
    if (type !== "DISPLAYED") {
      await Promise.all([
        this.cache.bumpUser(actor.publicId),
        this.cache.markProfileDirty(actor.publicId),
      ])
    }
  }

  private async serve(
    context: RecommendationContext,
    actor: Actor | null,
    hash: string,
    limit: number,
    rawCursor: string | undefined,
    request: RequestContext,
    compute: (asOf: Date) => Promise<RankedList>,
  ): Promise<RecommendationResponse> {
    const started = performance.now()
    const cursor = rawCursor
      ? decodeRecommendationCursor(rawCursor, { context, hash })
      : null
    const offset = cursor?.offset ?? 0
    try {
      const key = await this.cache.listKey(
        context,
        actor?.publicId ?? null,
        hash,
      )
      let list = await this.cache.get(key)
      // Après expiration, la page suivante reproduit le classement à la même date.
      const cacheHit =
        list !== null && (!cursor || list.asOf === cursor.asOf.toISOString())
      if (!cacheHit) {
        list = await compute(cursor?.asOf ?? new Date())
        if (!list.degraded) await this.cache.set(key, list)
      }
      const response = await this.page(
        context,
        actor,
        list!,
        offset,
        limit,
        hash,
      )
      this.observe(context, response, offset, cacheHit, started, request)
      this.events.publish({
        id: randomUUID(),
        name: RecommendationEvent.SERVED,
        occurredAt: new Date().toISOString(),
        aggregateId: response.meta.requestId,
        payload: {
          requestId: response.meta.requestId,
          context,
          algorithmVersion: response.meta.algorithmVersion,
          itemCount: response.items.length,
          userId: actor?.publicId ?? null,
          httpRequestId: request.requestId,
        } satisfies RecommendationServedPayload,
      })
      return response
    } catch (error) {
      if (!(error instanceof AppException) || error.getStatus() >= 500) {
        this.metrics.recommendation.errors.inc({
          code: error instanceof AppException ? error.code : "INTERNAL_ERROR",
        })
      }
      throw error
    }
  }

  private async computePersonalized(
    actor: Actor | null,
    filters: HardFilters,
    asOf: Date,
  ): Promise<RankedList> {
    const [declared, behavior, exclusions] = actor
      ? await Promise.all([
          this.preferences.declared(actor.userId),
          this.behavior.signals(actor.userId, actor.publicId, asOf),
          this.behaviorRepository.exclusions(actor.userId, asOf),
        ])
      : [null, null, NO_EXCLUSIONS]
    const preferences = declared
      ? withApplicableBudget(declared, filters)
      : null

    const listingTypes =
      filters.listingTypes.length > 0
        ? filters.listingTypes
        : (preferences?.listingTypes ?? [])
    const budget = preferences?.budget ?? null
    const criteria: CandidateCriteria = {
      listingTypes,
      price: budget
        ? {
            currency: budget.currency,
            period: budget.period,
            min: null,
            max: budgetCeiling(budget),
          }
        : null,
      propertyTypeIds: filters.propertyTypeIds,
      propertyCategory: null,
      neighborhoodIds: null,
      cityIds: filters.cityIds,
      excludeListingIds: exclusions.listingIds,
      excludePropertyIds: exclusions.propertyIds,
      publicId: null,
      excludeCreatedById: actor?.userId ?? null,
      boost: boostFrom(preferences, behavior),
      point: preferences?.point ?? null,
      asOf,
      limit: this.config.candidatePool,
    }
    const pool = await this.findCandidates(criteria)
    this.metrics.recommendation.candidates.observe(
      { context: "PERSONALIZED" },
      pool.length,
    )
    return this.rank(
      {
        mode: "PERSONALIZED",
        weights: this.config.weights,
        preferences,
        behavior,
        reference: null,
        viewedPropertyIds: exclusions.viewedPropertyIds,
        asOf,
      },
      pool,
      recommendationLevel(preferences, behavior),
    )
  }

  private async computeSimilar(
    actor: Actor | null,
    listingPublicId: string,
    asOf: Date,
  ): Promise<RankedList> {
    const [reference] = await this.findCandidates({
      ...emptyCriteria(asOf),
      publicId: listingPublicId,
      limit: 1,
    })
    if (!reference) {
      throw recommendationError(RecommendationErrorCode.LISTING_NOT_FOUND)
    }
    const exclusions = actor
      ? await this.behaviorRepository.exclusions(actor.userId, asOf)
      : NO_EXCLUSIONS
    const base: CandidateCriteria = {
      ...emptyCriteria(asOf),
      listingTypes: [reference.listingType],
      propertyCategory: reference.propertyCategory,
      cityIds: [reference.cityId],
      excludeListingIds: [reference.listingId, ...exclusions.listingIds],
      excludePropertyIds: [reference.propertyId, ...exclusions.propertyIds],
      excludeCreatedById: actor?.userId ?? null,
      boost: {
        neighborhoodIds: [reference.neighborhoodId],
        communeIds: [reference.communeId],
        propertyTypeIds: [reference.propertyTypeId],
      },
      limit: this.config.candidatePool,
    }
    const price = reference.price
    let pool = await this.findCandidates({
      ...base,
      price: {
        currency: price.currency,
        period: price.period,
        min: price.amount * (1 - SIMILAR_PRICE_BAND),
        max: price.amount * (1 + SIMILAR_PRICE_BAND),
      },
    })
    if (pool.length < SIMILAR_MIN_RESULTS) {
      const wider = await this.findCandidates({
        ...base,
        price: {
          currency: price.currency,
          period: price.period,
          min: null,
          max: null,
        },
      })
      const known = new Set(pool.map((candidate) => candidate.listingId))
      pool = [
        ...pool,
        ...wider.filter((candidate) => !known.has(candidate.listingId)),
      ]
    }
    this.metrics.recommendation.candidates.observe(
      { context: "SIMILAR" },
      pool.length,
    )
    return this.rank(
      {
        mode: "SIMILAR",
        weights: this.config.weights,
        preferences: null,
        behavior: null,
        reference,
        viewedPropertyIds: exclusions.viewedPropertyIds,
        asOf,
      },
      pool,
      "GENERIC",
    )
  }

  private async rank(
    context: ScoringContext,
    candidates: ListingCandidate[],
    level: RankedList["level"],
  ): Promise<RankedList> {
    const result = await this.ranker.rank({
      context,
      candidates,
      limit: this.config.limits.maxResults,
      diversity: this.config.diversity,
    })
    return {
      asOf: context.asOf.toISOString(),
      algorithmVersion: result.algorithmVersion,
      level,
      degraded: result.degraded,
      items: result.items.map((item) => ({
        listingId: item.candidate.listingId.toString(),
        propertyId: item.candidate.propertyId.toString(),
        publicId: item.candidate.publicId,
        score: item.score,
        reasons: item.reasons,
        components: item.components,
      })),
    }
  }

  private async findCandidates(
    criteria: CandidateCriteria,
  ): Promise<ListingCandidate[]> {
    try {
      return await this.candidates.find(criteria)
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          action: "recommendation_candidates_failed",
          error: error instanceof Error ? error.name : "unknown",
        }),
      )
      throw recommendationError(
        RecommendationErrorCode.RECOMMENDATIONS_UNAVAILABLE,
      )
    }
  }

  /** Page hydratée (annonces encore visibles seulement), persistée pour un compte. */
  private async page(
    context: RecommendationContext,
    actor: Actor | null,
    list: RankedList,
    offset: number,
    limit: number,
    hash: string,
  ): Promise<RecommendationResponse> {
    const slice = list.items.slice(offset, offset + limit)
    const listings = await this.hydrator.hydrate(
      slice.map((item) => ({
        listingId: item.publicId,
        sortKey: null,
        score: null,
        distanceMeters: null,
      })),
      { withScore: false },
    )
    const visible = new Map(
      listings.map((listing) => [listing.listingId, listing]),
    )
    const served = slice.filter((item) => visible.has(item.publicId))
    const generatedAt = new Date(list.asOf)

    let ids = new Map<bigint, string>()
    if (actor) {
      ids = await this.repository.saveServed(
        actor.userId,
        context,
        list.algorithmVersion,
        served.map((item) => ({
          listingId: BigInt(item.listingId),
          propertyId: BigInt(item.propertyId),
          rank: offset + slice.indexOf(item) + 1,
          score: item.score,
          reasons: item.reasons,
          components: item.components,
        })),
        generatedAt,
        new Date(Date.now() + this.config.ttlDays * 86_400_000),
      )
    }

    const nextOffset = offset + limit
    const hasMore = nextOffset < list.items.length
    return {
      items: served.map((item) => ({
        id: ids.get(BigInt(item.listingId)) ?? null,
        context,
        score: Math.round(item.score * 100),
        reasons: item.reasons.map((code) => ({
          code,
          label: RECOMMENDATION_REASON_LABELS[code],
        })),
        listing: visible.get(item.publicId)!,
        generatedAt: list.asOf,
      })),
      pagination: {
        nextCursor: hasMore
          ? encodeRecommendationCursor({
              context,
              offset: nextOffset,
              asOf: generatedAt,
              hash,
            })
          : null,
        hasMore,
        limit,
      },
      meta: {
        context,
        level: list.level,
        algorithmVersion: list.algorithmVersion,
        degraded: list.degraded,
        requestId: randomUUID(),
      },
    }
  }

  private parseLimit(raw: string | undefined): number {
    const { defaultLimit, maxLimit } = this.config.limits
    if (raw === undefined || raw.trim() === "") return defaultLimit
    const value = /^\d{1,3}$/.test(raw.trim()) ? Number(raw) : Number.NaN
    if (!(value >= 1) || value > maxLimit) {
      throw invalidQuery(`limit : entre 1 et ${maxLimit}`)
    }
    return value
  }

  /** Filtres explicites de la requête : stricts, codes vérifiés contre le référentiel. */
  private async parseFilters(
    params: RawRecommendationParams,
  ): Promise<HardFilters> {
    const list = (value: string | undefined) =>
      [
        ...new Set(
          (value ?? "")
            .split(",")
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].slice(0, 20)

    const listingTypes = list(params.listingType).map((value) => {
      const match = LISTING_TYPES.find((type) => type === value)
      if (!match) throw invalidQuery("listingType")
      return match
    })

    const propertyTypeIds: number[] = []
    for (const code of list(params.propertyType)) {
      const type = await this.catalog.propertyType(code)
      if (!type) throw invalidQuery("propertyType inconnu")
      propertyTypeIds.push(type.id)
    }

    let cityIds: number[] | null = null
    const cities = list(params.city)
    if (cities.length > 0) {
      const neighborhoods = await this.catalog.neighborhoods()
      cityIds = []
      for (const code of cities) {
        const ids = neighborhoods
          .filter((entry) => entry.cityCode === code)
          .map((entry) => entry.cityId)
        if (ids.length === 0) throw invalidQuery("city inconnue")
        cityIds.push(...ids)
      }
      cityIds = [...new Set(cityIds)].sort((a, b) => a - b)
    }
    return {
      listingTypes,
      propertyTypeIds: propertyTypeIds.sort((a, b) => a - b),
      cityIds,
    }
  }

  /** Log structuré sans donnée personnelle : ni identifiant, ni préférence, ni lieu. */
  private observe(
    context: RecommendationContext,
    response: RecommendationResponse,
    offset: number,
    cacheHit: boolean,
    started: number,
    request: RequestContext,
  ): void {
    const cache = cacheHit ? "hit" : "miss"
    const latency = performance.now() - started
    this.metrics.recommendation.requests.inc({
      context,
      level: response.meta.level,
      cache,
    })
    this.metrics.recommendation.latency.observe({ context, cache }, latency)
    if (offset === 0 && response.items.length === 0) {
      this.metrics.recommendation.empty.inc({ context })
    }
    this.logger.log(
      JSON.stringify({
        action: "recommendations",
        request_id: request.requestId ?? undefined,
        context,
        level: response.meta.level,
        authenticated: request.user !== undefined,
        algorithm: response.meta.algorithmVersion,
        degraded: response.meta.degraded,
        cache,
        page: offset === 0 ? 1 : "next",
        latency_ms: Math.round(latency),
        result_count: response.items.length,
      }),
    )
  }
}

/**
 * Le budget ne s'applique qu'aux offres de même périodicité : un budget
 * mensuel n'a pas de sens pour une vente demandée explicitement. Il n'est
 * alors pas utilisé (ni comme filtre, ni comme score), jamais converti.
 */
function withApplicableBudget(
  preferences: DeclaredPreferences,
  filters: HardFilters,
): DeclaredPreferences {
  const budget = preferences.budget
  if (!budget || filters.listingTypes.length === 0) return preferences
  const applicable = filters.listingTypes.some(
    (type) => DEFAULT_PRICE_PERIOD[type] === budget.period,
  )
  return applicable ? preferences : { ...preferences, budget: null }
}

function boostFrom(
  preferences: DeclaredPreferences | null,
  behavior: BehaviorSignals | null,
): CandidateCriteria["boost"] {
  const top = (weights: Record<string, number> | undefined) =>
    Object.entries(weights ?? {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, BOOST_FROM_BEHAVIOR)
      .map(([key]) => Number(key))
      .filter((id) => Number.isInteger(id))
  return {
    neighborhoodIds: [
      ...new Set([
        ...(preferences?.neighborhoodIds ?? []),
        ...top(behavior?.neighborhoods),
      ]),
    ],
    communeIds: [
      ...new Set([
        ...(preferences?.communeIds ?? []),
        ...top(behavior?.communes),
      ]),
    ],
    propertyTypeIds: preferences?.propertyTypeIds ?? [],
  }
}

function emptyCriteria(asOf: Date): CandidateCriteria {
  return {
    listingTypes: [],
    price: null,
    propertyTypeIds: [],
    propertyCategory: null,
    neighborhoodIds: null,
    cityIds: null,
    excludeListingIds: [],
    excludePropertyIds: [],
    publicId: null,
    excludeCreatedById: null,
    boost: { neighborhoodIds: [], communeIds: [], propertyTypeIds: [] },
    point: null,
    asOf,
    limit: 0,
  }
}
