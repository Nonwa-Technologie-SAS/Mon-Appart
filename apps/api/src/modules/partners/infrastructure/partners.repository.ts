import { Injectable } from "@nestjs/common"
import type { Prisma } from "../../../generated/prisma/client"
import type {
  PartnerCategory,
  PartnerCommercialStatus,
  PartnerIntegrationKind,
  PartnerIntegrationStatus,
  PartnerImportStatus,
} from "../../../generated/prisma/client"

import { DatabaseService } from "../../../database/database.service"

@Injectable()
export class PartnersRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  listPartners(take = 50, cursor?: string) {
    return this.db.client.partner.findMany({
      take: take + 1,
      ...(cursor
        ? { cursor: { publicId: cursor }, skip: 1 }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        integrations: {
          select: {
            publicId: true,
            kind: true,
            status: true,
            contractVersion: true,
            webhookUrl: true,
            webhookSecretFp: true,
            capabilities: true,
            lastCheckedAt: true,
            lastError: true,
          },
        },
      },
    })
  }

  findByPublicId(publicId: string) {
    return this.db.client.partner.findUnique({
      where: { publicId },
      include: {
        integrations: true,
        _count: { select: { deliveries: true, imports: true } },
      },
    })
  }

  findByCode(code: string) {
    return this.db.client.partner.findUnique({ where: { code } })
  }

  createPartner(input: {
    code: string
    name: string
    category: PartnerCategory
    description?: string | null
    commercialStatus?: PartnerCommercialStatus
    createdById?: bigint | null
  }) {
    return this.db.client.partner.create({
      data: {
        code: input.code,
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        commercialStatus: input.commercialStatus ?? "PROSPECT",
        createdById: input.createdById ?? null,
      },
    })
  }

  updatePartner(
    publicId: string,
    data: {
      name?: string
      description?: string | null
      commercialStatus?: PartnerCommercialStatus
    },
  ) {
    return this.db.client.partner.update({
      where: { publicId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }

  createIntegration(input: {
    partnerId: bigint
    kind: PartnerIntegrationKind
    status?: PartnerIntegrationStatus
    webhookUrl?: string | null
    webhookSecretFp?: string | null
    webhookSecretCipher?: string | null
    capabilities?: string[]
  }) {
    return this.db.client.partnerIntegration.create({
      data: {
        partnerId: input.partnerId,
        kind: input.kind,
        status: input.status ?? "PLANNED",
        webhookUrl: input.webhookUrl ?? null,
        webhookSecretFp: input.webhookSecretFp ?? null,
        webhookSecretCipher: input.webhookSecretCipher ?? null,
        capabilities: input.capabilities ?? [],
      },
    })
  }

  updateIntegration(
    publicId: string,
    data: {
      status?: PartnerIntegrationStatus
      webhookUrl?: string | null
      webhookSecretFp?: string | null
      webhookSecretCipher?: string | null
      lastCheckedAt?: Date | null
      lastError?: string | null
      capabilities?: string[]
    },
  ) {
    return this.db.client.partnerIntegration.update({
      where: { publicId },
      data: { ...data, updatedAt: new Date() },
    })
  }

  findIntegration(publicId: string) {
    return this.db.client.partnerIntegration.findUnique({
      where: { publicId },
      include: { partner: true },
    })
  }

  listActiveWebhookOut() {
    return this.db.client.partnerIntegration.findMany({
      where: {
        kind: "WEBHOOK_OUT",
        status: "ACTIVE",
        webhookUrl: { not: null },
        webhookSecretCipher: { not: null },
        partner: { commercialStatus: { in: ["ACTIVE", "PROSPECT"] } },
      },
      include: { partner: true },
    })
  }

  enqueueDelivery(input: {
    partnerId: bigint
    integrationId: bigint
    eventName: string
    eventId: string
    payload: object
  }) {
    return this.db.client.partnerDelivery.create({
      data: {
        partnerId: input.partnerId,
        integrationId: input.integrationId,
        eventName: input.eventName,
        eventId: input.eventId,
        payload: input.payload as Prisma.InputJsonValue,
      },
    })
  }

  async claimDueDeliveries(limit: number) {
    return this.db.transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: bigint
          public_id: string
          partner_id: bigint
          integration_id: bigint
          event_name: string
          event_id: string
          payload: unknown
          attempts: number
        }>
      >`
        SELECT id, public_id, partner_id, integration_id, event_name, event_id,
               payload, attempts
          FROM partner_deliveries
         WHERE status = 'PENDING'
           AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT ${limit}
      `
      if (rows.length === 0) return []
      const ids = rows.map((row) => row.id)
      await tx.partnerDelivery.updateMany({
        where: { id: { in: ids } },
        data: { status: "SENDING" },
      })
      return rows
    })
  }

  markDelivered(id: bigint) {
    return this.db.client.partnerDelivery.update({
      where: { id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        lastError: null,
      },
    })
  }

  markRetry(id: bigint, attempts: number, nextAttemptAt: Date, error: string) {
    return this.db.client.partnerDelivery.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts,
        nextAttemptAt,
        lastError: error.slice(0, 255),
      },
    })
  }

  markFailed(id: bigint, attempts: number, error: string) {
    return this.db.client.partnerDelivery.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts,
        lastError: error.slice(0, 255),
      },
    })
  }

  createImportBatch(input: {
    partnerId: bigint
    status: PartnerImportStatus
    filename: string
    rowCount: number
    acceptedRows: number
    rejectedRows: number
    report: object
  }) {
    return this.db.client.partnerImportBatch.create({
      data: {
        partnerId: input.partnerId,
        status: input.status,
        filename: input.filename.slice(0, 255),
        rowCount: input.rowCount,
        acceptedRows: input.acceptedRows,
        rejectedRows: input.rejectedRows,
        report: input.report as Prisma.InputJsonValue,
      },
    })
  }
}
