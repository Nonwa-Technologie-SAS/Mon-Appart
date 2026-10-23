import { Injectable } from "@nestjs/common"
import type {
  SupplyLeadInteractionKind,
  SupplyLeadSegment,
  SupplyLeadSource,
  SupplyLeadStage,
} from "../../../generated/prisma/client"

import type { AuthenticatedUser } from "../../identity"
import { ActorService } from "../../identity"
import { partnerError } from "../domain/partner-errors"
import { assertSupplyLeadStageTransition } from "../domain/supply-lead-pipeline"
import { SupplyLeadsRepository } from "../infrastructure/supply-leads.repository"

@Injectable()
export class SupplyLeadService {
  constructor(
    private readonly repository: SupplyLeadsRepository,
    private readonly actors: ActorService,
  ) {}

  async list(query: {
    cursor?: string
    take?: number
    stage?: SupplyLeadStage
    segment?: SupplyLeadSegment
  }) {
    const take = Math.min(query.take ?? 50, 100)
    const rows = await this.repository.list({
      take,
      cursor: query.cursor,
      stage: query.stage,
      segment: query.segment,
    })
    const hasMore = rows.length > take
    const slice = hasMore ? rows.slice(0, take) : rows
    const items = slice.map((row) => this.toListView(row))
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    }
  }

  async get(publicId: string) {
    const row = await this.repository.findByPublicId(publicId)
    if (!row) throw partnerError("SUPPLY_LEAD_NOT_FOUND")
    return this.toDetailView(row)
  }

  async create(
    user: AuthenticatedUser,
    input: {
      segment: SupplyLeadSegment
      displayName: string
      organizationName?: string
      phone?: string
      email?: string
      zoneCodes?: string[]
      propertyCategories?: string[]
      source?: SupplyLeadSource
      estimatedListings?: number
      nextActionAt?: string
      nextAction?: string
      notes?: string
      partnerPublicId?: string
    },
  ) {
    const actor = await this.actors.resolve(user)
    const partnerId = input.partnerPublicId
      ? await this.resolvePartnerId(input.partnerPublicId)
      : null

    const created = await this.repository.create({
      segment: input.segment,
      displayName: input.displayName.trim().slice(0, 160),
      organizationName: input.organizationName?.trim().slice(0, 160) ?? null,
      phone: input.phone?.trim().slice(0, 32) ?? null,
      email: input.email?.trim().slice(0, 255) ?? null,
      zoneCodes: (input.zoneCodes ?? []).map((z) => z.trim()).filter(Boolean),
      propertyCategories: (input.propertyCategories ?? [])
        .map((c) => c.trim())
        .filter(Boolean),
      source: input.source ?? "DIRECT",
      estimatedListings: input.estimatedListings ?? null,
      nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
      nextAction: input.nextAction?.trim().slice(0, 255) ?? null,
      notes: input.notes?.trim().slice(0, 2000) ?? null,
      partnerId,
      createdById: actor.userId,
    })

    await this.repository.addInteraction({
      leadId: created.id,
      kind: "NOTE",
      summary: "Prospect créé",
      detail: null,
      authorId: actor.userId,
    })

    return this.toListView(created)
  }

  async update(
    user: AuthenticatedUser,
    publicId: string,
    input: {
      segment?: SupplyLeadSegment
      stage?: SupplyLeadStage
      displayName?: string
      organizationName?: string | null
      phone?: string | null
      email?: string | null
      zoneCodes?: string[]
      propertyCategories?: string[]
      source?: SupplyLeadSource
      estimatedListings?: number | null
      submittedListings?: number
      approvedListings?: number
      activeListings?: number
      nextActionAt?: string | null
      nextAction?: string | null
      refusalReason?: string | null
      notes?: string | null
      partnerPublicId?: string | null
    },
  ) {
    const existing = await this.repository.findByPublicId(publicId)
    if (!existing) throw partnerError("SUPPLY_LEAD_NOT_FOUND")

    if (input.stage && input.stage !== existing.stage) {
      try {
        assertSupplyLeadStageTransition(existing.stage, input.stage)
      } catch {
        throw partnerError(
          "SUPPLY_LEAD_INVALID_TRANSITION",
          `${existing.stage} → ${input.stage}`,
        )
      }
      if (
        input.stage === "REFUSED" &&
        !input.refusalReason &&
        !existing.refusalReason
      ) {
        throw partnerError(
          "SUPPLY_LEAD_INVALID_TRANSITION",
          "Motif de refus requis",
        )
      }
      if (
        input.stage === "ACTIVATED" &&
        (input.activeListings ?? existing.activeListings) < 1
      ) {
        throw partnerError(
          "SUPPLY_LEAD_INVALID_TRANSITION",
          "Activation requiert au moins 1 annonce active",
        )
      }
    }

    const partnerId =
      input.partnerPublicId === undefined
        ? undefined
        : input.partnerPublicId === null || input.partnerPublicId === ""
          ? null
          : await this.resolvePartnerId(input.partnerPublicId)

    const actor = await this.actors.resolve(user)
    const updated = await this.repository.update(publicId, {
      segment: input.segment,
      stage: input.stage,
      displayName: input.displayName?.trim().slice(0, 160),
      organizationName:
        input.organizationName === undefined
          ? undefined
          : (input.organizationName?.trim().slice(0, 160) ?? null),
      phone:
        input.phone === undefined
          ? undefined
          : (input.phone?.trim().slice(0, 32) ?? null),
      email:
        input.email === undefined
          ? undefined
          : (input.email?.trim().slice(0, 255) ?? null),
      zoneCodes: input.zoneCodes?.map((z) => z.trim()).filter(Boolean),
      propertyCategories: input.propertyCategories
        ?.map((c) => c.trim())
        .filter(Boolean),
      source: input.source,
      estimatedListings: input.estimatedListings,
      submittedListings: input.submittedListings,
      approvedListings: input.approvedListings,
      activeListings: input.activeListings,
      nextActionAt:
        input.nextActionAt === undefined
          ? undefined
          : input.nextActionAt
            ? new Date(input.nextActionAt)
            : null,
      nextAction:
        input.nextAction === undefined
          ? undefined
          : (input.nextAction?.trim().slice(0, 255) ?? null),
      refusalReason:
        input.refusalReason === undefined
          ? undefined
          : (input.refusalReason?.trim().slice(0, 500) ?? null),
      notes:
        input.notes === undefined
          ? undefined
          : (input.notes?.trim().slice(0, 2000) ?? null),
      partnerId,
    })

    if (input.stage && input.stage !== existing.stage) {
      await this.repository.addInteraction({
        leadId: existing.id,
        kind: "STATUS_CHANGE",
        summary: `${existing.stage} → ${input.stage}`,
        detail: input.refusalReason ?? null,
        authorId: actor.userId,
      })
    }

    return this.toListView(updated)
  }

  async addInteraction(
    user: AuthenticatedUser,
    publicId: string,
    input: {
      kind: SupplyLeadInteractionKind
      summary: string
      detail?: string
    },
  ) {
    const existing = await this.repository.findByPublicId(publicId)
    if (!existing) throw partnerError("SUPPLY_LEAD_NOT_FOUND")
    const actor = await this.actors.resolve(user)
    await this.repository.addInteraction({
      leadId: existing.id,
      kind: input.kind,
      summary: input.summary.trim().slice(0, 500),
      detail: input.detail?.trim().slice(0, 2000) ?? null,
      authorId: actor.userId,
    })
    return this.get(publicId)
  }

  private async resolvePartnerId(publicId: string) {
    const partner = await this.repository.findPartnerIdByPublicId(publicId)
    if (!partner) throw partnerError("PARTNER_NOT_FOUND")
    return partner.id
  }

  private toListView(row: {
    publicId: string
    segment: SupplyLeadSegment
    stage: SupplyLeadStage
    displayName: string
    organizationName: string | null
    phone: string | null
    email: string | null
    zoneCodes: string[]
    propertyCategories: string[]
    source: SupplyLeadSource
    estimatedListings: number | null
    submittedListings: number
    approvedListings: number
    activeListings: number
    nextActionAt: Date | null
    nextAction: string | null
    refusalReason: string | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
    partner: { publicId: string; code: string; name: string } | null
    _count?: { interactions: number }
  }) {
    return {
      id: row.publicId,
      segment: row.segment,
      stage: row.stage,
      displayName: row.displayName,
      organizationName: row.organizationName,
      phone: row.phone,
      email: row.email,
      zoneCodes: row.zoneCodes,
      propertyCategories: row.propertyCategories,
      source: row.source,
      estimatedListings: row.estimatedListings,
      submittedListings: row.submittedListings,
      approvedListings: row.approvedListings,
      activeListings: row.activeListings,
      nextActionAt: row.nextActionAt?.toISOString() ?? null,
      nextAction: row.nextAction,
      refusalReason: row.refusalReason,
      notes: row.notes,
      partner: row.partner
        ? {
            id: row.partner.publicId,
            code: row.partner.code,
            name: row.partner.name,
          }
        : null,
      interactionCount: row._count?.interactions ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private toDetailView(
    row: NonNullable<
      Awaited<ReturnType<SupplyLeadsRepository["findByPublicId"]>>
    >,
  ) {
    return {
      ...this.toListView({
        ...row,
        _count: { interactions: row.interactions.length },
      }),
      interactions: row.interactions.map((item) => ({
        id: item.publicId,
        kind: item.kind,
        summary: item.summary,
        detail: item.detail,
        createdAt: item.createdAt.toISOString(),
        author: {
          id: item.author.publicId,
          name:
            [item.author.firstName, item.author.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || null,
        },
      })),
    }
  }
}
