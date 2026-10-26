import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { DomainEventPublisher } from "../../../common/events/domain-event.publisher"
import { DatabaseService } from "../../../database/database.service"
import type { ListingType } from "../../../generated/prisma/enums"
import type { Actor } from "../../identity"
import { SearchRetentionEvent } from "../domain/saved-search-events"
import {
  hasAlertableCriteria,
  sanitizeSavedSearchParams,
  type SavedSearchCriteria,
} from "../domain/saved-search-match"
import { searchError, SearchErrorCode } from "../domain/search-errors"
import {
  parseSearchQuery,
  type RawSearchParams,
  type SearchQuery,
} from "../domain/search-query"
import { SearchConfig } from "../search.config"

export const SAVED_SEARCH_FREQUENCIES = ["DAILY", "WEEKLY", "PAUSED"] as const
export type SavedSearchFrequency = (typeof SAVED_SEARCH_FREQUENCIES)[number]

export const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface SavedSearchView {
  id: string
  name: string
  params: Record<string, string>
  listingType: ListingType | null
  minPrice: number | null
  maxPrice: number | null
  currency: string
  alertsEnabled: boolean
  frequency: SavedSearchFrequency
  resumePath: string
  createdAt: string
  updatedAt: string
}

export interface CreateSavedSearchInput {
  name: string
  params: Record<string, unknown>
  alertsEnabled?: boolean
  frequency?: SavedSearchFrequency
}

export interface ProjectStatusView {
  projectStatus: ProjectStatus
  projectCompletedAt: string | null
  lastReactivationAt: string | null
}

const FREQUENCIES = new Set<string>(SAVED_SEARCH_FREQUENCIES)

@Injectable()
export class SavedSearchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: SearchConfig,
    private readonly events: DomainEventPublisher,
  ) {}

  async list(actor: Actor): Promise<SavedSearchView[]> {
    const rows = await this.db.client.savedSearch.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" },
      take: this.config.maxSavedSearches,
    })
    return rows.map((row) => this.view(row))
  }

  async create(
    actor: Actor,
    input: CreateSavedSearchInput,
  ): Promise<SavedSearchView> {
    const name = this.nameOf(input.name)
    const parsed = this.parse(input.params)
    const frequency = this.frequencyOf(input.frequency)
    const alertsEnabled =
      (input.alertsEnabled ?? true) &&
      frequency !== "PAUSED" &&
      hasAlertableCriteria(parsed.criteria)
    const count = await this.db.client.savedSearch.count({
      where: { userId: actor.userId },
    })
    if (count >= this.config.maxSavedSearches) {
      throw searchError(
        SearchErrorCode.SAVED_SEARCH_LIMIT,
        `${this.config.maxSavedSearches} maximum`,
      )
    }
    const row = await this.db.client.savedSearch.create({
      data: {
        userId: actor.userId,
        name,
        params: parsed.params,
        listingType: parsed.listingType,
        minPrice: parsed.criteria.minPrice,
        maxPrice: parsed.criteria.maxPrice,
        alertsEnabled,
        frequency,
      },
    })
    this.emit(SearchRetentionEvent.SAVED_SEARCH_CREATED, row.publicId, {
      alertsEnabled,
    })
    return this.view(row)
  }

  async update(
    actor: Actor,
    publicId: string,
    input: Partial<CreateSavedSearchInput>,
  ): Promise<SavedSearchView> {
    const existing = await this.requireOwned(actor.userId, publicId)
    const name =
      input.name !== undefined ? this.nameOf(input.name) : existing.name
    const parsed =
      input.params !== undefined
        ? this.parse(input.params)
        : this.parse(asParams(existing.params))
    const frequency =
      input.frequency !== undefined
        ? this.frequencyOf(input.frequency)
        : (existing.frequency as SavedSearchFrequency)
    const requestedAlerts = input.alertsEnabled ?? existing.alertsEnabled
    const alertsEnabled =
      requestedAlerts &&
      frequency !== "PAUSED" &&
      hasAlertableCriteria(parsed.criteria)
    const row = await this.db.client.savedSearch.update({
      where: { id: existing.id },
      data: {
        name,
        params: parsed.params,
        listingType: parsed.listingType,
        minPrice: parsed.criteria.minPrice,
        maxPrice: parsed.criteria.maxPrice,
        alertsEnabled,
        frequency,
        updatedAt: new Date(),
      },
    })
    this.emit(SearchRetentionEvent.SAVED_SEARCH_UPDATED, row.publicId, {
      alertsEnabled,
    })
    return this.view(row)
  }

  async remove(actor: Actor, publicId: string): Promise<void> {
    const existing = await this.requireOwned(actor.userId, publicId)
    await this.db.client.savedSearch.delete({ where: { id: existing.id } })
  }

  async resume(
    actor: Actor,
    publicId: string,
  ): Promise<{ params: Record<string, string>; resumePath: string }> {
    const existing = await this.requireOwned(actor.userId, publicId)
    this.emit(SearchRetentionEvent.SEARCH_RESUMED, existing.publicId, {
      savedSearchId: existing.publicId,
    })
    const view = this.view(existing)
    return { params: view.params, resumePath: view.resumePath }
  }

  async projectStatus(actor: Actor): Promise<ProjectStatusView> {
    const row = await this.db.client.userPreference.findUnique({
      where: { userId: actor.userId },
      select: {
        projectStatus: true,
        projectCompletedAt: true,
        lastReactivationAt: true,
      },
    })
    return {
      projectStatus: (row?.projectStatus ?? "ACTIVE") as ProjectStatus,
      projectCompletedAt: row?.projectCompletedAt?.toISOString() ?? null,
      lastReactivationAt: row?.lastReactivationAt?.toISOString() ?? null,
    }
  }

  async setProjectStatus(
    actor: Actor,
    status: ProjectStatus,
  ): Promise<ProjectStatusView> {
    if (!PROJECT_STATUSES.includes(status)) {
      throw searchError(SearchErrorCode.INVALID_SAVED_SEARCH, "projectStatus")
    }
    const now = new Date()
    const completedAt = status === "COMPLETED" ? now : null
    await this.db.client.userPreference.upsert({
      where: { userId: actor.userId },
      create: {
        userId: actor.userId,
        projectStatus: status,
        projectCompletedAt: completedAt,
      },
      update: {
        projectStatus: status,
        projectCompletedAt: completedAt,
        updatedAt: now,
      },
    })
    if (status === "COMPLETED") {
      await this.db.client.savedSearch.updateMany({
        where: { userId: actor.userId, alertsEnabled: true },
        data: { alertsEnabled: false, frequency: "PAUSED", updatedAt: now },
      })
    }
    this.emit(SearchRetentionEvent.PROJECT_STATUS_CHANGED, actor.publicId, {
      status,
    })
    return this.projectStatus(actor)
  }

  criteriaFromParams(params: Record<string, string>): SavedSearchCriteria {
    return this.parse(params).criteria
  }

  private parse(raw: Record<string, unknown>): {
    params: Record<string, string>
    listingType: ListingType | null
    criteria: SavedSearchCriteria
    query: SearchQuery
  } {
    const params = sanitizeSavedSearchParams(raw)
    if (Object.keys(params).length === 0 && !params.q) {
      throw searchError(
        SearchErrorCode.INVALID_SAVED_SEARCH,
        "au moins un critère",
      )
    }
    let query: SearchQuery
    try {
      query = parseSearchQuery(params as RawSearchParams, this.config.limits)
    } catch {
      throw searchError(SearchErrorCode.INVALID_SAVED_SEARCH)
    }
    const criteria: SavedSearchCriteria = {
      listingTypes: query.listingTypes,
      propertyTypes: query.propertyTypes,
      cities: query.cities,
      communes: query.communes,
      neighborhoods: query.neighborhoods,
      minPrice: query.price.min,
      maxPrice: query.price.max,
      minSurface: query.surface.min,
      maxSurface: query.surface.max,
      minBedrooms: query.bedrooms.min,
      minBathrooms: query.bathrooms.min,
    }
    return {
      params,
      listingType: query.listingTypes[0] ?? null,
      criteria,
      query,
    }
  }

  private async requireOwned(userId: bigint, publicId: string) {
    const row = await this.db.client.savedSearch.findFirst({
      where: { publicId, userId },
    })
    if (!row) throw searchError(SearchErrorCode.SAVED_SEARCH_NOT_FOUND)
    return row
  }

  private nameOf(value: string): string {
    const name = value.trim()
    if (name.length < 2 || name.length > 80) {
      throw searchError(SearchErrorCode.INVALID_SAVED_SEARCH, "name")
    }
    return name
  }

  private frequencyOf(value: string | undefined): SavedSearchFrequency {
    if (value === undefined) return "DAILY"
    if (!FREQUENCIES.has(value)) {
      throw searchError(SearchErrorCode.INVALID_SAVED_SEARCH, "frequency")
    }
    return value as SavedSearchFrequency
  }

  private view(row: {
    publicId: string
    name: string
    params: unknown
    listingType: ListingType | null
    minPrice: { toString(): string } | null
    maxPrice: { toString(): string } | null
    currency: string
    alertsEnabled: boolean
    frequency: SavedSearchFrequency
    createdAt: Date
    updatedAt: Date
  }): SavedSearchView {
    const params = sanitizeSavedSearchParams(asParams(row.params))
    return {
      id: row.publicId,
      name: row.name,
      params,
      listingType: row.listingType,
      minPrice: toNumber(row.minPrice),
      maxPrice: toNumber(row.maxPrice),
      currency: row.currency,
      alertsEnabled: row.alertsEnabled,
      frequency: row.frequency,
      resumePath: resumePath(params),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private emit(
    name: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): void {
    this.events.publish({
      id: randomUUID(),
      name,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
    })
  }
}

function asParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toNumber(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString())
}

export function resumePath(params: Record<string, string>): string {
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.listingType) query.set("type", params.listingType)
  if (params.propertyType) query.set("type", params.propertyType)
  if (params.maxPrice) query.set("maxPrice", params.maxPrice)
  if (params.lat) query.set("lat", params.lat)
  if (params.lng) query.set("lng", params.lng)
  const qs = query.toString()
  return qs ? `/?${qs}` : "/"
}
