import { Inject, Injectable } from "@nestjs/common"

import type { Tx } from "../../../database/database.service"
import type { Prisma } from "../../../generated/prisma/client"
import { MEDIA_DOCUMENT_ACCESS, type MediaDocumentAccess } from "../../media"
import { holdsClaimedRelation } from "../domain/badges"
import { runPrechecks, type RiskFinding } from "../domain/risk-rules"
import {
  documentRequirement,
  isRequestableType,
  missingDocumentGroups,
  REQUIRES_VERIFIED_IDENTITY,
} from "../domain/verification-requirements"
import { isValidVerification } from "../domain/verification-status"
import { hasValidIdentity } from "../infrastructure/publication-facts"
import {
  TrustRepository,
  type VerificationRow,
} from "../infrastructure/trust.repository"
import { readyDocumentTypes } from "./verification-views"

/**
 * Précontrôles automatiques d'un dossier soumis. Ils aident l'instruction et
 * peuvent lever des alertes ; ils ne décident jamais. Une pièce non analysée
 * par un antivirus est signalée comme telle, pas comme suspecte.
 */
@Injectable()
export class PrecheckService {
  constructor(
    private readonly trust: TrustRepository,
    @Inject(MEDIA_DOCUMENT_ACCESS) private readonly media: MediaDocumentAccess,
  ) {}

  async run(
    row: VerificationRow,
    tx: Tx,
    now: Date,
  ): Promise<{ prechecks: Prisma.InputJsonObject; findings: RiskFinding[] }> {
    const live = row.documents.filter((doc) => doc.status !== "REMOVED")
    const requirement = isRequestableType(row.type)
      ? documentRequirement(
          row.type,
          row.property?.propertyType.category ?? null,
        )
      : null
    const duplicateUploaders = new Set<bigint>()
    for (const doc of live) {
      for (const uploader of await this.media.otherUploadersOfSameContent(
        doc.media.id,
      )) {
        if (uploader !== row.userId) duplicateUploaders.add(uploader)
      }
    }

    let currentRelations = null
    let otherSoleOwners: number | null = null
    if (row.propertyId !== null) {
      const relations = await this.trust.currentRelations(row.propertyId, tx)
      currentRelations = relations.get(row.userId) ?? []
      if (row.type === "PROPERTY_OWNERSHIP") {
        const facts = await this.trust.propertyFacts(row.propertyId, tx)
        otherSoleOwners = facts.filter(
          (fact) =>
            fact.type === "PROPERTY_OWNERSHIP" &&
            fact.userId !== row.userId &&
            fact.claimedRelation === "SOLE" &&
            isValidVerification(fact, now) &&
            holdsClaimedRelation(fact, relations),
        ).length
      }
    }

    const identityVerified =
      isRequestableType(row.type) &&
      REQUIRES_VERIFIED_IDENTITY.includes(row.type)
        ? await hasValidIdentity(tx, row.userId, now)
        : null

    const { prechecks, findings } = runPrechecks(
      {
        requiredDocumentsCovered: requirement
          ? missingDocumentGroups(requirement, readyDocumentTypes(row))
              .length === 0
          : true,
        unscannedDocuments: live.filter((doc) => {
          const scan = (doc.media.metadata as { scan?: string } | null)?.scan
          return !scan || scan === "NOT_SCANNED"
        }).length,
        phoneVerified: row.user.phoneVerifiedAt !== null,
        emailVerified: row.user.emailVerifiedAt !== null,
        identityVerified,
        claimedRelation: row.claimedRelation,
        currentRelations,
        duplicateUploaders: duplicateUploaders.size,
        otherSoleOwners,
      },
      now,
    )
    for (const finding of findings) {
      await this.trust.raiseSignal(
        {
          ruleCode: finding.rule,
          severity: finding.severity,
          dedupKey: `${finding.rule}:verification:${row.publicId}`,
          userId: row.userId,
          verificationId: row.id,
          details: finding.details,
        },
        tx,
      )
    }
    return { prechecks: { ...prechecks }, findings }
  }
}
