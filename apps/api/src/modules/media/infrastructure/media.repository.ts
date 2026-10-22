import { Injectable } from "@nestjs/common"

import { DatabaseService, type Db } from "../../../database/database.service"
import { Prisma } from "../../../generated/prisma/client"
import type {
  MediaStatus,
  PropertyStatus,
} from "../../../generated/prisma/enums"

export interface PropertyRef {
  id: bigint
  publicId: string
  status: PropertyStatus
  deletedAt: Date | null
}

export const mediaSelect = {
  id: true,
  publicId: true,
  propertyId: true,
  purpose: true,
  type: true,
  storageProvider: true,
  storageKey: true,
  url: true,
  mimeType: true,
  fileSize: true,
  width: true,
  height: true,
  durationMs: true,
  sortOrder: true,
  status: true,
  visibility: true,
  uploadedById: true,
  originalFilename: true,
  uploadExpiresAt: true,
  uploadedAt: true,
  readyAt: true,
  nextAttemptAt: true,
  processingAttempts: true,
  processingError: true,
  metadata: true,
  contentSha256: true,
  purgeAfter: true,
  purgedAt: true,
  createdAt: true,
  deletedAt: true,
  property: {
    select: { id: true, publicId: true, status: true, deletedAt: true },
  },
  variants: {
    select: {
      kind: true,
      storageKey: true,
      isPublic: true,
      url: true,
      mimeType: true,
      fileSize: true,
      width: true,
      height: true,
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.MediaSelect

export type MediaRow = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>

export interface ClaimedJob {
  id: bigint
  attempt: number
}

/** Statuts qui occupent une place dans la limite de médias d'un bien. */
const COUNTED_STATUSES: MediaStatus[] = [
  "PENDING_UPLOAD",
  "UPLOADED",
  "PROCESSING",
  "READY",
]

@Injectable()
export class MediaRepository {
  constructor(private readonly db: DatabaseService) {}

  get client() {
    return this.db.client
  }

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.transaction(run)
  }

  findProperty(publicId: string, db: Db = this.db.client) {
    return db.property.findUnique({
      where: { publicId },
      select: { id: true, publicId: true, status: true, deletedAt: true },
    })
  }

  /** Verrouille le bien : sérialise ajouts, réordonnancements et suppressions. */
  async lockProperty(publicId: string, db: Db): Promise<PropertyRef | null> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM properties WHERE public_id = ${publicId}::uuid FOR UPDATE
    `
    if (!rows[0]) return null
    return db.property.findUnique({
      where: { id: rows[0].id },
      select: { id: true, publicId: true, status: true, deletedAt: true },
    })
  }

  findByPublicId(publicId: string, db: Db = this.db.client) {
    return db.media.findUnique({ where: { publicId }, select: mediaSelect })
  }

  findById(id: bigint, db: Db = this.db.client) {
    return db.media.findUnique({ where: { id }, select: mediaSelect })
  }

  countForProperty(propertyId: bigint, db: Db): Promise<number> {
    return db.media.count({
      where: {
        propertyId,
        deletedAt: null,
        status: { in: COUNTED_STATUSES },
      },
    })
  }

  countOpenSessions(userId: bigint, now: Date, db: Db): Promise<number> {
    return db.media.count({
      where: {
        uploadedById: userId,
        status: "PENDING_UPLOAD",
        deletedAt: null,
        uploadExpiresAt: { gt: now },
      },
    })
  }

  async nextSortOrder(propertyId: bigint, db: Db): Promise<number> {
    const result = await db.media.aggregate({
      where: { propertyId, deletedAt: null },
      _max: { sortOrder: true },
    })
    return Math.min(32_767, (result._max.sortOrder ?? -1) + 1)
  }

  /** Médias non supprimés d'un bien, dans l'ordre d'affichage. */
  listForProperty(
    propertyId: bigint,
    publicOnly: boolean,
    db: Db = this.db.client,
  ) {
    return db.media.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(publicOnly ? { status: "READY", visibility: "PUBLIC" } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: mediaSelect,
    })
  }

  /**
   * Prend jusqu'à `limit` travaux échus : médias confirmés, ou en traitement
   * dont le bail a expiré (worker arrêté). `SKIP LOCKED` : plusieurs workers
   * ne prennent jamais le même média ; le compteur d'essais sert de jeton.
   */
  async claimJobs(limit: number, leaseSeconds: number): Promise<ClaimedJob[]> {
    const rows = await this.db.client.$queryRaw<
      { id: bigint; processing_attempts: number }[]
    >`
      UPDATE media
      SET status = 'PROCESSING',
          processing_attempts = processing_attempts + 1,
          next_attempt_at = now() + ${leaseSeconds}::int * interval '1 second'
      WHERE id IN (
        SELECT id FROM media
        WHERE next_attempt_at <= now()
          AND deleted_at IS NULL
          AND status IN ('UPLOADED', 'PROCESSING')
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, processing_attempts
    `
    return rows.map((row) => ({
      id: row.id,
      attempt: Number(row.processing_attempts),
    }))
  }

  /** Met à jour un travail seulement si ce worker le détient encore. */
  async finishJob(
    job: ClaimedJob,
    data: Prisma.MediaUncheckedUpdateManyInput,
    db: Db = this.db.client,
  ): Promise<boolean> {
    const result = await db.media.updateMany({
      where: {
        id: job.id,
        status: "PROCESSING",
        processingAttempts: job.attempt,
        deletedAt: null,
      },
      data,
    })
    return result.count === 1
  }

  countPendingJobs(): Promise<number> {
    return this.db.client.media.count({
      where: { nextAttemptAt: { not: null }, deletedAt: null },
    })
  }

  /**
   * Sessions jamais confirmées : marquées FAILED et masquées, objets purgés
   * immédiatement (un envoi inachevé n'a aucune valeur à conserver).
   */
  async expireSessions(before: Date, limit: number): Promise<string[]> {
    const rows = await this.db.client.$queryRaw<{ public_id: string }[]>`
      UPDATE media
      SET status = 'FAILED',
          processing_error = 'UPLOAD_EXPIRED',
          deleted_at = now(),
          purge_after = now()
      WHERE id IN (
        SELECT id FROM media
        WHERE status = 'PENDING_UPLOAD'
          AND deleted_at IS NULL
          AND upload_expires_at < ${before}
        ORDER BY upload_expires_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING public_id::text AS public_id
    `
    return rows.map((row) => row.public_id)
  }

  /**
   * Purges échues, avec un bail de 10 minutes : un autre passage ne reprend
   * pas un média en cours de purge.
   */
  async claimPurges(limit: number): Promise<bigint[]> {
    const rows = await this.db.client.$queryRaw<{ id: bigint }[]>`
      UPDATE media
      SET purge_after = now() + interval '10 minutes'
      WHERE id IN (
        SELECT id FROM media
        WHERE purge_after <= now()
          AND purged_at IS NULL
          AND deleted_at IS NOT NULL
        ORDER BY purge_after
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `
    return rows.map((row) => row.id)
  }

  /**
   * Clés citées par une vérification (module Trust) : référence historique
   * `verifications.document_reference`, ou justificatif rattaché à un dossier
   * et pas encore retiré par la politique de rétention.
   */
  async referencedKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set()
    const [legacy, attached] = await Promise.all([
      this.db.client.verification.findMany({
        where: { documentReference: { in: keys } },
        select: { documentReference: true },
      }),
      this.db.client.verificationDocument.findMany({
        where: {
          status: { not: "REMOVED" },
          media: { storageKey: { in: keys } },
        },
        select: { media: { select: { storageKey: true } } },
      }),
    ])
    return new Set([
      ...legacy.flatMap((row) =>
        row.documentReference ? [row.documentReference] : [],
      ),
      ...attached.map((row) => row.media.storageKey),
    ])
  }

  /** Auteurs d'autres médias non purgés au contenu identique (détection de réutilisation). */
  async uploadersOfSameContent(
    sha256: string,
    excludeMediaId: bigint,
  ): Promise<bigint[]> {
    const rows = await this.db.client.media.findMany({
      where: {
        contentSha256: sha256,
        id: { not: excludeMediaId },
        purgedAt: null,
        uploadedById: { not: null },
      },
      select: { uploadedById: true },
      distinct: ["uploadedById"],
      take: 20,
    })
    return rows.flatMap((row) => (row.uploadedById ? [row.uploadedById] : []))
  }

  /** Médias connus pour une liste d'identifiants publics (détection d'orphelins). */
  async knownMedia(
    publicIds: string[],
  ): Promise<Map<string, { purged: boolean }>> {
    if (publicIds.length === 0) return new Map()
    const rows = await this.db.client.media.findMany({
      where: { publicId: { in: publicIds } },
      select: { publicId: true, purgedAt: true },
    })
    return new Map(
      rows.map((row) => [row.publicId, { purged: row.purgedAt !== null }]),
    )
  }
}
