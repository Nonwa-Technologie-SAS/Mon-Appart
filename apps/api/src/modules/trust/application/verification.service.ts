import { Inject, Injectable } from "@nestjs/common"

import type { Tx } from "../../../database/database.service"
import type {
  OwnershipType,
  VerificationDocumentType,
  VerificationType,
} from "../../../generated/prisma/enums"
import { NotificationService } from "../../communication"
import type { Actor, ClientContext } from "../../identity"
import {
  MEDIA_DOCUMENT_ACCESS,
  type MediaDocumentAccess,
  type UploadSessionView,
} from "../../media"
import { MANAGING_RELATIONS, PropertyAccessService } from "../../property"
import { trustError } from "../domain/trust-errors"
import {
  TrustAuditAction,
  TrustEvent,
  VERIFICATION_ENTITY,
  VerificationAction,
} from "../domain/trust-events"
import { verificationNotice } from "../domain/trust-notifications"
import {
  CLAIMABLE_RELATIONS,
  documentRequirement,
  isRequestableType,
  missingDocumentGroups,
  REQUIRES_VERIFIED_IDENTITY,
  SCOPE_OF,
  type RequestableType,
} from "../domain/verification-requirements"
import {
  canTransitionVerification,
  EDITABLE_STATUSES,
  isValidVerification,
  OPEN_VERIFICATION_STATUSES,
} from "../domain/verification-status"
import { hasValidIdentity } from "../infrastructure/publication-facts"
import {
  TrustRepository,
  type VerificationRow,
} from "../infrastructure/trust.repository"
import { TrustConfig } from "../trust.config"
import { PrecheckService } from "./precheck.service"
import { TrustActivity } from "./trust-activity"
import {
  readyDocumentTypes,
  verificationView,
  type VerificationView,
} from "./verification-views"

export interface CreateVerificationInput {
  type: VerificationType
  propertyId?: string
  listingId?: string
  claimedRelation?: OwnershipType
  declaration?: { statement?: string; agencyName?: string }
}

export interface AddDocumentInput {
  documentType: VerificationDocumentType
  mimeType: string
  size: number
  filename?: string
}

/** Un dossier approuvé peut être renouvelé dans les 30 jours précédant son échéance. */
const RENEWAL_WINDOW_MS = 30 * 86_400_000

/**
 * Workflow du déclarant. L'utilisateur courant vient du JWT ; il n'agit que
 * sur ses propres dossiers (404 sinon) et ne peut jamais en changer l'issue :
 * aucune route utilisateur n'écrit de décision.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly access: PropertyAccessService,
    private readonly prechecks: PrecheckService,
    private readonly notifications: NotificationService,
    private readonly activity: TrustActivity,
    private readonly config: TrustConfig,
    @Inject(MEDIA_DOCUMENT_ACCESS) private readonly media: MediaDocumentAccess,
  ) {}

  async create(
    actor: Actor,
    input: CreateVerificationInput,
    client: ClientContext,
  ): Promise<VerificationView> {
    if (!isRequestableType(input.type)) {
      throw trustError(
        "VERIFICATION_TYPE_NOT_SUPPORTED",
        input.type === "PHONE" || input.type === "EMAIL"
          ? "utilisez la vérification par code de votre compte"
          : input.type,
      )
    }
    const type = input.type
    const scope = await this.resolveScope(actor, type, input)
    const claimable = CLAIMABLE_RELATIONS[type]
    if (claimable) {
      if (
        !input.claimedRelation ||
        !claimable.includes(input.claimedRelation)
      ) {
        throw trustError("CLAIMED_RELATION_INVALID", claimable.join(", "))
      }
    } else if (input.claimedRelation) {
      throw trustError("CLAIMED_RELATION_INVALID", "non applicable")
    }

    const publicId = await this.trust.transaction(async (tx) => {
      await this.trust.lockUser(actor.userId, tx)
      const existing = await this.trust.findSameScope(
        { userId: actor.userId, type, ...scope },
        [...OPEN_VERIFICATION_STATUSES, "VERIFIED"],
        tx,
      )
      if (existing.some((row) => row.status !== "VERIFIED")) {
        throw trustError("VERIFICATION_ALREADY_OPEN")
      }
      const now = new Date()
      const renewable = (row: { status: "VERIFIED"; expiresAt: Date | null }) =>
        row.expiresAt !== null &&
        row.expiresAt.getTime() - now.getTime() < RENEWAL_WINDOW_MS
      if (
        existing.some(
          (row) =>
            row.status === "VERIFIED" &&
            isValidVerification(row, now) &&
            !renewable({ status: "VERIFIED", expiresAt: row.expiresAt }),
        )
      ) {
        throw trustError("VERIFICATION_ALREADY_VERIFIED")
      }
      const created = await tx.verification.create({
        data: {
          userId: actor.userId,
          type,
          status: "DRAFT",
          submittedAt: null,
          propertyId: scope.propertyId,
          listingId: scope.listingId,
          claimedRelation: input.claimedRelation ?? null,
          declaration: cleanDeclaration(type, input.declaration),
        },
        select: { id: true, publicId: true },
      })
      await this.trust.addEvent(
        {
          verificationId: created.id,
          action: VerificationAction.CREATED,
          toStatus: "DRAFT",
          actorId: actor.userId,
          actorKind: "USER",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_CREATED,
          actorId: actor.userId,
          entityType: VERIFICATION_ENTITY,
          entityId: created.publicId,
          newValues: {
            type,
            propertyId: input.propertyId ?? null,
            listingId: input.listingId ?? null,
            claimedRelation: input.claimedRelation ?? null,
          },
        },
        client,
        tx,
      )
      return created.publicId
    })

    this.activity.emit(TrustEvent.VERIFICATION_CREATED, publicId, {
      verificationId: publicId,
      type,
    })
    this.activity.log("trust.verification_created", client, {
      verification_id: publicId,
      type,
    })
    return this.get(actor, publicId)
  }

  async list(actor: Actor): Promise<VerificationView[]> {
    const rows = await this.trust.client.verification.findMany({
      where: { userId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: { publicId: true },
    })
    const views: VerificationView[] = []
    for (const row of rows) views.push(await this.get(actor, row.publicId))
    return views
  }

  async get(actor: Actor, publicId: string): Promise<VerificationView> {
    const row = await this.own(actor, publicId)
    return verificationView(row, await this.trust.events(row.id))
  }

  /**
   * Ouvre l'envoi d'une pièce : la session Media et le rattachement au
   * dossier sont créés dans la même transaction. Le client envoie ensuite le
   * fichier puis confirme via `/media/upload-sessions/:id/complete`. Une
   * pièce téléversée ne vérifie rien tant qu'un relecteur n'a pas décidé.
   */
  async addDocument(
    actor: Actor,
    publicId: string,
    input: AddDocumentInput,
    client: ClientContext,
  ): Promise<{ documentId: string; upload: UploadSessionView }> {
    const row = await this.own(actor, publicId)
    this.assertDocumentAccepted(row, input.documentType)
    let documentId = ""
    const upload = await this.media.createVerificationUpload(
      actor,
      {
        mimeType: input.mimeType,
        size: input.size,
        ...(input.filename ? { filename: input.filename } : {}),
      },
      client,
      async (tx, media) => {
        const locked = await this.lockOwn(actor, publicId, tx)
        if (!EDITABLE_STATUSES.includes(locked.status)) {
          throw trustError("VERIFICATION_NOT_EDITABLE")
        }
        const live = locked.documents.filter((doc) => doc.status !== "REMOVED")
        if (live.length >= this.config.maxDocuments) {
          throw trustError(
            "TOO_MANY_DOCUMENTS",
            `maximum ${this.config.maxDocuments}`,
          )
        }
        const created = await tx.verificationDocument.create({
          data: {
            verificationId: locked.id,
            mediaId: media.id,
            documentType: input.documentType,
            addedById: actor.userId,
          },
          select: { publicId: true },
        })
        documentId = created.publicId
        await this.trust.addEvent(
          {
            verificationId: locked.id,
            action: VerificationAction.DOCUMENT_ADDED,
            fromStatus: locked.status,
            toStatus: locked.status,
            actorId: actor.userId,
            actorKind: "USER",
          },
          tx,
        )
        await this.activity.audit(
          {
            action: TrustAuditAction.VERIFICATION_DOCUMENT_ADDED,
            actorId: actor.userId,
            entityType: VERIFICATION_ENTITY,
            entityId: locked.publicId,
            // Type de pièce seulement : ni numéro, ni nom de fichier, ni contenu.
            newValues: {
              documentId: created.publicId,
              documentType: input.documentType,
              mediaId: media.publicId,
            },
          },
          client,
          tx,
        )
      },
    )
    this.activity.log("trust.document_added", client, {
      verification_id: publicId,
      document_type: input.documentType,
    })
    return { documentId, upload }
  }

  /**
   * Retire une pièce d'un dossier modifiable. Jamais vue par un relecteur :
   * fichier purgé aussitôt ; déjà soumise : conservée le temps de la rétention.
   */
  async removeDocument(
    actor: Actor,
    publicId: string,
    documentId: string,
    client: ClientContext,
  ): Promise<VerificationView> {
    const { mediaId, submitted } = await this.trust.transaction(async (tx) => {
      const locked = await this.lockOwn(actor, publicId, tx)
      if (!EDITABLE_STATUSES.includes(locked.status)) {
        throw trustError("VERIFICATION_NOT_EDITABLE")
      }
      const doc = locked.documents.find(
        (entry) => entry.publicId === documentId && entry.status !== "REMOVED",
      )
      if (!doc) throw trustError("VERIFICATION_DOCUMENT_NOT_FOUND")
      await tx.verificationDocument.update({
        where: { id: doc.id },
        data: { status: "REMOVED", removedAt: new Date() },
      })
      await this.trust.addEvent(
        {
          verificationId: locked.id,
          action: VerificationAction.DOCUMENT_REMOVED,
          fromStatus: locked.status,
          toStatus: locked.status,
          actorId: actor.userId,
          actorKind: "USER",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_DOCUMENT_REMOVED,
          actorId: actor.userId,
          entityType: VERIFICATION_ENTITY,
          entityId: locked.publicId,
          oldValues: { documentId, documentType: doc.documentType },
        },
        client,
        tx,
      )
      return { mediaId: doc.media.id, submitted: locked.submittedAt !== null }
    })
    await this.media.retire(mediaId, { immediate: !submitted })
    return this.get(actor, publicId)
  }

  async submit(
    actor: Actor,
    publicId: string,
    input: { attestation: boolean },
    client: ClientContext,
  ): Promise<VerificationView> {
    if (input.attestation !== true) throw trustError("ATTESTATION_REQUIRED")
    const result = await this.trust.transaction(async (tx) => {
      const locked = await this.lockOwn(actor, publicId, tx)
      if (!canTransitionVerification(locked.status, "PENDING")) {
        throw trustError("INVALID_VERIFICATION_TRANSITION")
      }
      const type = locked.type as RequestableType
      const now = new Date()
      if (
        REQUIRES_VERIFIED_IDENTITY.includes(type) &&
        !(await hasValidIdentity(tx, actor.userId, now))
      ) {
        throw trustError("IDENTITY_VERIFICATION_REQUIRED")
      }
      this.assertScopeStillValid(locked)
      const live = locked.documents.filter(
        (doc) => doc.status !== "REMOVED" && doc.media.deletedAt === null,
      )
      if (
        live.some((doc) =>
          ["PENDING_UPLOAD", "UPLOADED", "PROCESSING"].includes(
            doc.media.status,
          ),
        )
      ) {
        throw trustError("DOCUMENTS_NOT_READY")
      }
      const requirement = documentRequirement(
        type,
        locked.property?.propertyType.category ?? null,
      )
      const missing = missingDocumentGroups(
        requirement,
        readyDocumentTypes(locked),
      )
      if (missing.length > 0) {
        throw trustError(
          "DOCUMENTS_INCOMPLETE",
          missing.map((group) => group.join(" | ")).join(" ; "),
        )
      }
      const { prechecks, findings } = await this.prechecks.run(locked, tx, now)
      const resubmission = locked.status === "NEEDS_MORE_INFORMATION"
      await tx.verification.update({
        where: { id: locked.id },
        data: {
          status: "PENDING",
          attestedAt: now,
          submittedAt: now,
          prechecks,
          ...(findings.some((finding) => finding.severity === "HIGH")
            ? { priority: "HIGH" }
            : {}),
        },
      })
      await this.trust.addEvent(
        {
          verificationId: locked.id,
          action: resubmission
            ? VerificationAction.RESUBMITTED
            : VerificationAction.SUBMITTED,
          fromStatus: locked.status,
          toStatus: "PENDING",
          actorId: actor.userId,
          actorKind: "USER",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_SUBMITTED,
          actorId: actor.userId,
          entityType: VERIFICATION_ENTITY,
          entityId: locked.publicId,
          oldValues: { status: locked.status },
          newValues: {
            status: "PENDING",
            attested: true,
            documents: live.length,
          },
        },
        client,
        tx,
      )
      await this.notifications.notify(
        actor.userId,
        {
          type: "VERIFICATION",
          ...verificationNotice.submitted(locked.type),
          data: { verificationId: locked.publicId, status: "PENDING" },
        },
        tx,
      )
      return { type: locked.type, signals: findings.length }
    })

    this.activity.emit(TrustEvent.VERIFICATION_SUBMITTED, publicId, {
      verificationId: publicId,
      type: result.type,
    })
    this.activity.log("trust.verification_submitted", client, {
      verification_id: publicId,
      type: result.type,
      signals: result.signals,
    })
    return this.get(actor, publicId)
  }

  async withdraw(
    actor: Actor,
    publicId: string,
    client: ClientContext,
  ): Promise<VerificationView> {
    const type = await this.trust.transaction(async (tx) => {
      const locked = await this.lockOwn(actor, publicId, tx)
      if (!canTransitionVerification(locked.status, "WITHDRAWN")) {
        throw trustError("INVALID_VERIFICATION_TRANSITION")
      }
      await tx.verification.update({
        where: { id: locked.id },
        data: { status: "WITHDRAWN", decidedAt: new Date() },
      })
      await this.trust.addEvent(
        {
          verificationId: locked.id,
          action: VerificationAction.WITHDRAWN,
          fromStatus: locked.status,
          toStatus: "WITHDRAWN",
          actorId: actor.userId,
          actorKind: "USER",
        },
        tx,
      )
      await this.activity.audit(
        {
          action: TrustAuditAction.VERIFICATION_WITHDRAWN,
          actorId: actor.userId,
          entityType: VERIFICATION_ENTITY,
          entityId: locked.publicId,
          oldValues: { status: locked.status },
          newValues: { status: "WITHDRAWN" },
        },
        client,
        tx,
      )
      return locked.type
    })
    this.activity.emit(TrustEvent.VERIFICATION_WITHDRAWN, publicId, {
      verificationId: publicId,
      type,
    })
    return this.get(actor, publicId)
  }

  // -------------------------------------------------------------------------

  private async own(actor: Actor, publicId: string): Promise<VerificationRow> {
    const row = await this.trust.findVerification(publicId)
    if (!row || row.userId !== actor.userId) {
      throw trustError("VERIFICATION_NOT_FOUND")
    }
    return row
  }

  private async lockOwn(
    actor: Actor,
    publicId: string,
    tx: Tx,
  ): Promise<VerificationRow> {
    const row = await this.trust.lockVerification(publicId, tx)
    if (!row || row.userId !== actor.userId) {
      throw trustError("VERIFICATION_NOT_FOUND")
    }
    return row
  }

  private assertDocumentAccepted(
    row: VerificationRow,
    documentType: VerificationDocumentType,
  ): void {
    if (!EDITABLE_STATUSES.includes(row.status)) {
      throw trustError("VERIFICATION_NOT_EDITABLE")
    }
    if (!isRequestableType(row.type)) {
      throw trustError("VERIFICATION_TYPE_NOT_SUPPORTED")
    }
    const accepted = documentRequirement(
      row.type,
      row.property?.propertyType.category ?? null,
    ).accepted
    if (!accepted.includes(documentType)) {
      throw trustError("DOCUMENT_TYPE_NOT_ACCEPTED", accepted.join(", "))
    }
  }

  /** Le bien doit exister encore (non supprimé) au moment de la soumission. */
  private assertScopeStillValid(row: VerificationRow): void {
    if (row.property && row.property.deletedAt !== null) {
      throw trustError("PROPERTY_NOT_FOUND")
    }
  }

  /**
   * Cible du dossier : jamais un identifiant interne fourni par le client.
   * Le déclarant doit gérer le bien (propriétaire ou mandataire rattaché).
   */
  private async resolveScope(
    actor: Actor,
    type: RequestableType,
    input: CreateVerificationInput,
  ): Promise<{ propertyId: bigint | null; listingId: bigint | null }> {
    const scope = SCOPE_OF[type]
    if (scope === "USER") {
      if (input.propertyId || input.listingId) {
        throw trustError("VERIFICATION_SCOPE_INVALID")
      }
      return { propertyId: null, listingId: null }
    }
    let propertyId: bigint
    let listingId: bigint | null = null
    if (scope === "LISTING") {
      if (!input.listingId || input.propertyId) {
        throw trustError("VERIFICATION_SCOPE_INVALID")
      }
      const listing = await this.trust.findListing(input.listingId)
      if (!listing || listing.deletedAt !== null) {
        throw trustError("LISTING_NOT_FOUND")
      }
      propertyId = listing.propertyId
      listingId = listing.id
    } else {
      if (!input.propertyId || input.listingId) {
        throw trustError("VERIFICATION_SCOPE_INVALID")
      }
      const property = await this.trust.findProperty(input.propertyId)
      if (!property || property.deletedAt !== null) {
        throw trustError("PROPERTY_NOT_FOUND")
      }
      propertyId = property.id
    }
    const relation = await this.access.relationOf(actor, propertyId)
    if (relation === null || !MANAGING_RELATIONS.includes(relation)) {
      // Pas de rattachement : l'existence du bien ne fuit pas.
      throw trustError(
        scope === "LISTING" ? "LISTING_NOT_FOUND" : "PROPERTY_NOT_FOUND",
      )
    }
    return { propertyId, listingId }
  }
}

/** Déclaration minimale : jamais de numéro de pièce, de date de naissance ni d'adresse. */
function cleanDeclaration(
  type: RequestableType,
  declaration: CreateVerificationInput["declaration"],
): { statement?: string; agencyName?: string } {
  const result: { statement?: string; agencyName?: string } = {}
  const statement = declaration?.statement?.trim()
  if (statement) result.statement = statement.slice(0, 500)
  const agencyName = declaration?.agencyName?.trim()
  if (type === "AGENCY" && agencyName) {
    result.agencyName = agencyName.slice(0, 200)
  }
  return result
}
