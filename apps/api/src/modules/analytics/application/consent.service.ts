import { Injectable } from "@nestjs/common"

import { insertAuditLog } from "../../../common/audit/audit-log"
import {
  ActorService,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { AnalyticsConfig } from "../analytics.config"
import { analyticsError } from "../domain/analytics-errors"
import { AnalyticsRepository } from "../infrastructure/analytics.repository"

export type ConsentSource = "web" | "mobile" | "api"

export interface ConsentView {
  /** `UNSET` : jamais exprimé ; `GRANTED` d'une ancienne politique compte comme `UNSET`. */
  status: "GRANTED" | "DENIED" | "UNSET"
  policyVersion: string | null
  currentPolicyVersion: string
  updatedAt: string | null
}

export const ConsentAuditAction = {
  GRANTED: "ANALYTICS_CONSENT_GRANTED",
  WITHDRAWN: "ANALYTICS_CONSENT_WITHDRAWN",
} as const

/**
 * Consentement à la mesure d'audience, distinct des CGU et du marketing.
 * Le retrait efface les événements de navigation déjà collectés pour le
 * compte ; les événements métier (intérêt légitime) restent.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly actors: ActorService,
    private readonly config: AnalyticsConfig,
  ) {}

  async get(user: AuthenticatedUser): Promise<ConsentView> {
    const actor = await this.actors.resolve(user)
    return this.view(await this.repository.findConsent(actor.userId))
  }

  /** Vrai si le compte a consenti à la politique en vigueur. */
  async isGranted(userId: bigint): Promise<boolean> {
    const consent = await this.repository.findConsent(userId)
    return (
      consent?.status === "GRANTED" &&
      consent.policyVersion === this.config.policyVersion
    )
  }

  async set(
    user: AuthenticatedUser,
    input: { granted: boolean; policyVersion: string; source: ConsentSource },
    client: ClientContext,
  ): Promise<ConsentView> {
    if (input.granted && input.policyVersion !== this.config.policyVersion) {
      throw analyticsError(
        "CONSENT_POLICY_MISMATCH",
        `version attendue ${this.config.policyVersion}`,
      )
    }
    const actor = await this.actors.resolve(user)
    const saved = await this.repository.transaction(async (tx) => {
      const before = await this.repository.findConsent(actor.userId, tx)
      const status = input.granted ? "GRANTED" : "DENIED"
      const row = await this.repository.upsertConsent(
        actor.userId,
        { status, policyVersion: input.policyVersion, source: input.source },
        tx,
      )
      let erased = 0
      if (!input.granted) {
        const deleted = await tx.analyticsEvent.deleteMany({
          where: { userId: actor.userId, basis: "CONSENT" },
        })
        erased = deleted.count
      }
      if (
        before?.status !== status ||
        before.policyVersion !== input.policyVersion
      ) {
        await insertAuditLog(tx, {
          action: input.granted
            ? ConsentAuditAction.GRANTED
            : ConsentAuditAction.WITHDRAWN,
          actorId: actor.userId,
          entityType: "user",
          entityId: actor.publicId,
          oldValues: before
            ? { status: before.status, policyVersion: before.policyVersion }
            : undefined,
          newValues: {
            status,
            policyVersion: input.policyVersion,
            source: input.source,
            ...(input.granted ? {} : { erasedEvents: erased }),
          },
          ipAddress: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        })
      }
      return row
    })
    return this.view(saved)
  }

  private view(
    consent: {
      status: "GRANTED" | "DENIED"
      policyVersion: string
      updatedAt: Date
    } | null,
  ): ConsentView {
    const current = this.config.policyVersion
    const status =
      !consent ||
      (consent.status === "GRANTED" && consent.policyVersion !== current)
        ? "UNSET"
        : consent.status
    return {
      status,
      policyVersion: consent?.policyVersion ?? null,
      currentPolicyVersion: current,
      updatedAt: consent?.updatedAt.toISOString() ?? null,
    }
  }
}
