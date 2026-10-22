import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import type {
  OwnershipType,
  TrustSignalSeverity,
  VerificationStatus,
  VerificationType,
} from "../../../generated/prisma/enums"
import type { VerificationFact } from "../domain/badges"

export const verificationSelect = {
  id: true,
  publicId: true,
  userId: true,
  propertyId: true,
  listingId: true,
  type: true,
  status: true,
  claimedRelation: true,
  priority: true,
  assignedToId: true,
  reasonCode: true,
  rejectionReason: true,
  declaration: true,
  prechecks: true,
  attestedAt: true,
  submittedAt: true,
  decidedAt: true,
  verifiedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      publicId: true,
      firstName: true,
      lastName: true,
      status: true,
      phoneVerifiedAt: true,
      emailVerifiedAt: true,
    },
  },
  property: {
    select: {
      id: true,
      publicId: true,
      title: true,
      status: true,
      deletedAt: true,
      propertyType: { select: { category: true } },
    },
  },
  listing: { select: { publicId: true, title: true } },
  assignedTo: { select: { publicId: true } },
  documents: {
    select: {
      id: true,
      publicId: true,
      documentType: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      removedAt: true,
      media: {
        select: {
          id: true,
          publicId: true,
          status: true,
          mimeType: true,
          fileSize: true,
          metadata: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.VerificationSelect

export type VerificationRow = Prisma.VerificationGetPayload<{
  select: typeof verificationSelect
}>

export const eventSelect = {
  action: true,
  fromStatus: true,
  toStatus: true,
  actorKind: true,
  reasonCode: true,
  userMessage: true,
  internalNote: true,
  createdAt: true,
  actor: { select: { publicId: true } },
} satisfies Prisma.VerificationEventSelect

export type VerificationEventRow = Prisma.VerificationEventGetPayload<{
  select: typeof eventSelect
}>

const factSelect = {
  type: true,
  status: true,
  userId: true,
  propertyId: true,
  listingId: true,
  claimedRelation: true,
  verifiedAt: true,
  decidedAt: true,
  expiresAt: true,
} satisfies Prisma.VerificationSelect

export interface SignalInput {
  ruleCode: string
  severity: TrustSignalSeverity
  dedupKey: string
  userId?: bigint | null
  listingId?: bigint | null
  verificationId?: bigint | null
  details: Record<string, string | number | boolean>
}

@Injectable()
export class TrustRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.transaction(run)
  }

  /**
   * Verrou du compte : sérialise les créations concurrentes (un seul dossier
   * ouvert par cible, un seul signalement ouvert par cible et par déclarant).
   */
  async lockUser(userId: bigint, db: Db): Promise<void> {
    await db.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
  }

  /** Verrou du dossier : une seule décision ou modification à la fois. */
  async lockVerification(
    publicId: string,
    db: Db,
  ): Promise<VerificationRow | null> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM verifications WHERE public_id = ${publicId}::uuid FOR UPDATE
    `
    if (!rows[0]) return null
    return db.verification.findUnique({
      where: { id: rows[0].id },
      select: verificationSelect,
    })
  }

  findVerification(publicId: string, db: Db = this.db.client) {
    return db.verification.findUnique({
      where: { publicId },
      select: verificationSelect,
    })
  }

  events(verificationId: bigint, db: Db = this.db.client) {
    return db.verificationEvent.findMany({
      where: { verificationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: eventSelect,
    })
  }

  addEvent(
    data: Prisma.VerificationEventUncheckedCreateInput,
    db: Db,
  ): Promise<unknown> {
    return db.verificationEvent.create({ data, select: { id: true } })
  }

  findUserByPublicId(publicId: string, db: Db = this.db.client) {
    return db.user.findFirst({
      where: { publicId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        status: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
      },
    })
  }

  findUserById(id: bigint, db: Db = this.db.client) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        publicId: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
      },
    })
  }

  findProperty(publicId: string, db: Db = this.db.client) {
    return db.property.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        status: true,
        deletedAt: true,
        propertyType: { select: { category: true } },
      },
    })
  }

  findListing(publicId: string, db: Db = this.db.client) {
    return db.listing.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        status: true,
        deletedAt: true,
        propertyId: true,
        property: {
          select: {
            id: true,
            publicId: true,
            status: true,
            deletedAt: true,
          },
        },
        prices: {
          where: { validTo: null },
          select: { validFrom: true },
          take: 1,
        },
      },
    })
  }

  /** Rattachements courants d'un bien, par utilisateur. */
  async currentRelations(
    propertyId: bigint,
    db: Db = this.db.client,
  ): Promise<Map<bigint, OwnershipType[]>> {
    const rows = await db.propertyOwnership.findMany({
      where: { propertyId, isCurrent: true },
      select: { ownerId: true, ownershipType: true },
    })
    const relations = new Map<bigint, OwnershipType[]>()
    for (const row of rows) {
      relations.set(row.ownerId, [
        ...(relations.get(row.ownerId) ?? []),
        row.ownershipType,
      ])
    }
    return relations
  }

  /** Dossiers d'un même déclarant, type et cible, dans les statuts donnés. */
  findSameScope(
    scope: {
      userId: bigint
      type: VerificationType
      propertyId: bigint | null
      listingId: bigint | null
    },
    statuses: readonly VerificationStatus[],
    db: Db,
  ) {
    return db.verification.findMany({
      where: {
        userId: scope.userId,
        type: scope.type,
        propertyId: scope.propertyId,
        listingId: scope.listingId,
        status: { in: [...statuses] },
      },
      select: { id: true, status: true, expiresAt: true },
    })
  }

  /** Faits des vérifications d'un utilisateur (badges, score, prérequis). */
  userFacts(
    userId: bigint,
    db: Db = this.db.client,
  ): Promise<VerificationFact[]> {
    return db.verification.findMany({
      where: { userId, status: { in: ["VERIFIED", "REVOKED", "EXPIRED"] } },
      select: factSelect,
    })
  }

  /** Vérifications approuvées d'un bien (et de ses annonces), tous déclarants. */
  propertyFacts(
    propertyId: bigint,
    db: Db = this.db.client,
  ): Promise<VerificationFact[]> {
    return db.verification.findMany({
      where: { propertyId, status: "VERIFIED" },
      select: factSelect,
    })
  }

  countOpenOnProperty(
    propertyId: bigint,
    listingId: bigint,
    db: Db = this.db.client,
  ): Promise<number> {
    return db.verification.count({
      where: {
        propertyId,
        status: { in: ["PENDING", "IN_REVIEW", "NEEDS_MORE_INFORMATION"] },
        OR: [{ listingId: null }, { listingId }],
      },
    })
  }

  /** Le compte détient-il la permission d'instruire (rôle courant) ? */
  async canInstruct(userId: bigint, db: Db = this.db.client): Promise<boolean> {
    const rows = await db.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = ${userId}
          AND (r.code = 'SUPER_ADMIN' OR p.code = 'verification:review')
      ) AS ok
    `
    return rows[0]?.ok === true
  }

  /**
   * Alerte idempotente : tant qu'une alerte de même clé est ouverte, aucune
   * nouvelle n'est créée (index unique partiel). Requête paramétrée.
   */
  async raiseSignal(signal: SignalInput, db: Db): Promise<string | null> {
    const rows = await db.$queryRaw<{ public_id: string }[]>`
      INSERT INTO trust_signals
        (rule_code, severity, user_id, listing_id, verification_id, details, dedup_key)
      VALUES (
        ${signal.ruleCode},
        ${signal.severity}::trust_signal_severity,
        ${signal.userId ?? null},
        ${signal.listingId ?? null},
        ${signal.verificationId ?? null},
        ${JSON.stringify(signal.details)}::jsonb,
        ${signal.dedupKey}
      )
      ON CONFLICT (dedup_key) WHERE status = 'OPEN' DO NOTHING
      RETURNING public_id::text AS public_id
    `
    return rows[0]?.public_id ?? null
  }
}
