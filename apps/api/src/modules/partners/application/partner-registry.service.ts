import { Injectable } from "@nestjs/common"
import type {
  PartnerCategory,
  PartnerCommercialStatus,
  PartnerIntegrationKind,
  PartnerIntegrationStatus,
} from "../../../generated/prisma/client"

import type { AuthenticatedUser } from "../../identity"
import { ActorService } from "../../identity"
import {
  encryptSecret,
  fingerprintSecret,
  generateWebhookSecret,
} from "../domain/partner-secrets"
import { partnerError } from "../domain/partner-errors"
import { PartnersConfig } from "../partners.config"
import { PartnersRepository } from "../infrastructure/partners.repository"

const CODE_RE = /^[a-z][a-z0-9_-]{1,62}$/

function assertHttpsUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw partnerError("INVALID_WEBHOOK_URL")
  }
  if (parsed.protocol !== "https:") throw partnerError("INVALID_WEBHOOK_URL")
  if (parsed.username || parsed.password) {
    throw partnerError("INVALID_WEBHOOK_URL", "Identifiants interdits dans l’URL")
  }
}

@Injectable()
export class PartnerRegistryService {
  constructor(
    private readonly repository: PartnersRepository,
    private readonly actors: ActorService,
    private readonly config: PartnersConfig,
  ) {}

  async list(query: { cursor?: string; take?: number }) {
    const take = Math.min(query.take ?? 50, 100)
    const rows = await this.repository.listPartners(take, query.cursor)
    const hasMore = rows.length > take
    const slice = hasMore ? rows.slice(0, take) : rows
    const items = slice.map((row) => this.toPartnerView(row))
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    }
  }

  async get(publicId: string) {
    const row = await this.repository.findByPublicId(publicId)
    if (!row) throw partnerError("PARTNER_NOT_FOUND")
    return {
      ...this.toPartnerView(row),
      counts: row._count,
    }
  }

  async create(
    user: AuthenticatedUser,
    input: {
      code: string
      name: string
      category: PartnerCategory
      description?: string
      commercialStatus?: PartnerCommercialStatus
    },
  ) {
    const code = input.code.trim().toLowerCase()
    if (!CODE_RE.test(code)) {
      throw partnerError(
        "DUPLICATE_CODE",
        "Code : minuscules, chiffres, _ ou - (2–63).",
      )
    }
    if (await this.repository.findByCode(code)) {
      throw partnerError("DUPLICATE_CODE")
    }
    const actor = await this.actors.resolve(user)
    const created = await this.repository.createPartner({
      code,
      name: input.name.trim().slice(0, 160),
      category: input.category,
      description: input.description?.trim().slice(0, 1000) ?? null,
      commercialStatus: input.commercialStatus,
      createdById: actor.userId,
    })
    return this.toPartnerView(created)
  }

  async updateCommercial(
    publicId: string,
    input: {
      name?: string
      description?: string | null
      commercialStatus?: PartnerCommercialStatus
    },
  ) {
    const existing = await this.repository.findByPublicId(publicId)
    if (!existing) throw partnerError("PARTNER_NOT_FOUND")
    const updated = await this.repository.updatePartner(publicId, {
      name: input.name?.trim().slice(0, 160),
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim().slice(0, 1000) ?? null,
      commercialStatus: input.commercialStatus,
    })
    return this.toPartnerView(updated)
  }

  /**
   * Crée une intégration WEBHOOK_OUT. Le secret en clair n’est renvoyé qu’une fois.
   */
  async createWebhookOut(
    partnerPublicId: string,
    input: { webhookUrl: string; activate?: boolean },
  ) {
    if (!this.config.secretsKey) throw partnerError("SECRETS_KEY_REQUIRED")
    assertHttpsUrl(input.webhookUrl)
    const partner = await this.repository.findByPublicId(partnerPublicId)
    if (!partner) throw partnerError("PARTNER_NOT_FOUND")

    const secret = generateWebhookSecret()
    const integration = await this.repository.createIntegration({
      partnerId: partner.id,
      kind: "WEBHOOK_OUT",
      status: input.activate ? "ACTIVE" : "INTEGRATING",
      webhookUrl: input.webhookUrl,
      webhookSecretFp: fingerprintSecret(secret),
      webhookSecretCipher: encryptSecret(this.config.secretsKey, secret),
      capabilities: ["listing.published", "listing.status_changed"],
    })

    return {
      integration: this.toIntegrationView(integration),
      /** Affiché une seule fois — à transmettre au partenaire hors bande. */
      webhookSecretOnce: secret,
      signatureHeader: "Mon-Appart-Signature",
      note: "Conservez le secret hors de Mon Appart. Il ne sera plus renvoyé.",
    }
  }

  async setIntegrationStatus(
    integrationPublicId: string,
    status: PartnerIntegrationStatus,
  ) {
    const row = await this.repository.findIntegration(integrationPublicId)
    if (!row) throw partnerError("INTEGRATION_NOT_FOUND")
    const updated = await this.repository.updateIntegration(
      integrationPublicId,
      { status, lastError: null },
    )
    return this.toIntegrationView(updated)
  }

  async createIntegrationStub(
    partnerPublicId: string,
    input: {
      kind: Exclude<PartnerIntegrationKind, "WEBHOOK_OUT">
      status?: PartnerIntegrationStatus
      capabilities?: string[]
    },
  ) {
    const partner = await this.repository.findByPublicId(partnerPublicId)
    if (!partner) throw partnerError("PARTNER_NOT_FOUND")
    const integration = await this.repository.createIntegration({
      partnerId: partner.id,
      kind: input.kind,
      status: input.status ?? "PLANNED",
      capabilities: input.capabilities ?? [],
    })
    return this.toIntegrationView(integration)
  }

  private toPartnerView(
    row: {
      publicId: string
      code: string
      name: string
      category: PartnerCategory
      description: string | null
      commercialStatus: PartnerCommercialStatus
      createdAt: Date
      updatedAt: Date
      integrations?: Array<{
        publicId: string
        kind: PartnerIntegrationKind
        status: PartnerIntegrationStatus
        contractVersion: string
        webhookUrl: string | null
        webhookSecretFp: string | null
        capabilities: string[]
        lastCheckedAt: Date | null
        lastError: string | null
      }>
    },
  ) {
    return {
      id: row.publicId,
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
      commercialStatus: row.commercialStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      integrations: (row.integrations ?? []).map((i) =>
        this.toIntegrationView(i),
      ),
    }
  }

  private toIntegrationView(row: {
    publicId: string
    kind: PartnerIntegrationKind
    status: PartnerIntegrationStatus
    contractVersion?: string
    webhookUrl?: string | null
    webhookSecretFp?: string | null
    capabilities?: string[]
    lastCheckedAt?: Date | null
    lastError?: string | null
  }) {
    return {
      id: row.publicId,
      kind: row.kind,
      status: row.status,
      contractVersion: row.contractVersion ?? "2026-10-v1",
      webhookUrl: row.webhookUrl ?? null,
      hasWebhookSecret: Boolean(row.webhookSecretFp),
      webhookSecretFingerprint: row.webhookSecretFp
        ? row.webhookSecretFp.slice(0, 12) + "…"
        : null,
      capabilities: row.capabilities ?? [],
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastError: row.lastError ?? null,
    }
  }
}
