import { Injectable } from "@nestjs/common"
import type {
  SupplyLeadInteractionKind,
  SupplyLeadSegment,
  SupplyLeadSource,
  SupplyLeadStage,
} from "../../../generated/prisma/client"

import { DatabaseService } from "../../../database/database.service"

@Injectable()
export class SupplyLeadsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(input: {
    take: number
    cursor?: string
    stage?: SupplyLeadStage
    segment?: SupplyLeadSegment
  }) {
    const cursorRow = input.cursor
      ? await this.db.client.supplyLead.findUnique({
          where: { publicId: input.cursor },
          select: { createdAt: true, id: true },
        })
      : null

    return this.db.client.supplyLead.findMany({
      where: {
        ...(input.stage ? { stage: input.stage } : {}),
        ...(input.segment ? { segment: input.segment } : {}),
        ...(cursorRow
          ? {
              OR: [
                { createdAt: { lt: cursorRow.createdAt } },
                {
                  createdAt: cursorRow.createdAt,
                  id: { lt: cursorRow.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.take + 1,
      include: {
        partner: { select: { publicId: true, code: true, name: true } },
        _count: { select: { interactions: true } },
      },
    })
  }

  findByPublicId(publicId: string) {
    return this.db.client.supplyLead.findUnique({
      where: { publicId },
      include: {
        partner: { select: { publicId: true, code: true, name: true } },
        interactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            author: {
              select: { publicId: true, firstName: true, lastName: true },
            },
          },
        },
      },
    })
  }

  create(input: {
    segment: SupplyLeadSegment
    stage?: SupplyLeadStage
    displayName: string
    organizationName?: string | null
    phone?: string | null
    email?: string | null
    zoneCodes: string[]
    propertyCategories: string[]
    source: SupplyLeadSource
    estimatedListings?: number | null
    nextActionAt?: Date | null
    nextAction?: string | null
    notes?: string | null
    partnerId?: bigint | null
    createdById: bigint
    assigneeId?: bigint | null
  }) {
    return this.db.client.supplyLead.create({
      data: {
        segment: input.segment,
        stage: input.stage ?? "IDENTIFIED",
        displayName: input.displayName,
        organizationName: input.organizationName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        zoneCodes: input.zoneCodes,
        propertyCategories: input.propertyCategories,
        source: input.source,
        estimatedListings: input.estimatedListings ?? null,
        nextActionAt: input.nextActionAt ?? null,
        nextAction: input.nextAction ?? null,
        notes: input.notes ?? null,
        partnerId: input.partnerId ?? null,
        createdById: input.createdById,
        assigneeId: input.assigneeId ?? null,
      },
      include: {
        partner: { select: { publicId: true, code: true, name: true } },
        _count: { select: { interactions: true } },
      },
    })
  }

  update(
    publicId: string,
    data: {
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
      nextActionAt?: Date | null
      nextAction?: string | null
      refusalReason?: string | null
      notes?: string | null
      partnerId?: bigint | null
      assigneeId?: bigint | null
    },
  ) {
    return this.db.client.supplyLead.update({
      where: { publicId },
      data: { ...data, updatedAt: new Date() },
      include: {
        partner: { select: { publicId: true, code: true, name: true } },
        _count: { select: { interactions: true } },
      },
    })
  }

  addInteraction(input: {
    leadId: bigint
    kind: SupplyLeadInteractionKind
    summary: string
    detail?: string | null
    authorId: bigint
  }) {
    return this.db.client.supplyLeadInteraction.create({
      data: {
        leadId: input.leadId,
        kind: input.kind,
        summary: input.summary,
        detail: input.detail ?? null,
        authorId: input.authorId,
      },
    })
  }

  findPartnerIdByPublicId(publicId: string) {
    return this.db.client.partner.findUnique({
      where: { publicId },
      select: { id: true },
    })
  }
}
