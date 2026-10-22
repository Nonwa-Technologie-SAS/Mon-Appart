import { Inject, Injectable } from "@nestjs/common"

import { MediaVariantKind } from "../../../generated/prisma/enums"
import { variantKey, mediaIdOfKey } from "../domain/storage-keys"
import { MediaRepository } from "../infrastructure/media.repository"
import {
  OBJECT_STORAGE,
  StorageError,
  type BucketScope,
  type ObjectStorage,
} from "../infrastructure/storage/object-storage"
import { MediaConfig } from "../media.config"
import { UPLOAD_GRACE_MS } from "./upload.service"
import { MediaActivity } from "./media-activity"

export interface OrphanReport {
  dryRun: boolean
  scanned: number
  orphans: number
  deleted: number
  /** Objets orphelins conservés : cités par une vérification (Trust). */
  retained: number
}

/** Un objet plus récent peut appartenir à un traitement en cours. */
const ORPHAN_MIN_AGE_MS = 24 * 3_600_000
const BATCH = 100

/**
 * Nettoyage planifié : sessions expirées, purge définitive après rétention,
 * détection d'objets orphelins. Aucune suppression d'objet n'a lieu sans
 * vérifier qu'il n'est plus référencé (média, vérification d'identité).
 */
@Injectable()
export class MediaCleanupService {
  constructor(
    private readonly media: MediaRepository,
    private readonly config: MediaConfig,
    private readonly activity: MediaActivity,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /** Sessions non confirmées au-delà de l'échéance et du délai de grâce. */
  async expireSessions(): Promise<number> {
    const before = new Date(Date.now() - UPLOAD_GRACE_MS)
    let total = 0
    for (;;) {
      const expired = await this.media.expireSessions(before, 500)
      total += expired.length
      if (expired.length < 500) break
    }
    if (total > 0) {
      this.activity.log("media.sessions_expired", null, { count: total })
    }
    return total
  }

  /** Supprime les objets des médias dont la rétention est échue. */
  async purgeDue(): Promise<number> {
    let purged = 0
    for (;;) {
      const ids = await this.media.claimPurges(BATCH)
      for (const id of ids) {
        if (await this.purgeOne(id)) purged++
      }
      if (ids.length < BATCH) break
    }
    if (purged > 0) this.activity.log("media.purged", null, { count: purged })
    return purged
  }

  private async purgeOne(id: bigint): Promise<boolean> {
    const row = await this.media.findById(id)
    if (!row || row.deletedAt === null || row.purgedAt !== null) return false
    const referenced = await this.media.referencedKeys([row.storageKey])
    if (referenced.has(row.storageKey)) {
      // Justificatif cité par une vérification : conservé, réexaminé après une nouvelle rétention.
      await this.media.client.media.update({
        where: { id },
        data: {
          purgeAfter: new Date(
            Date.now() +
              Math.max(1, this.config.deletedRetentionDays) * 86_400_000,
          ),
        },
      })
      this.activity.log("media.purge_retained", null, {
        media_id: row.publicId,
        reason: "verification_reference",
      })
      return false
    }
    try {
      await this.storage.delete("private", row.storageKey)
      for (const key of this.variantKeys(row.publicId, row.storageKey)) {
        await this.storage.delete("private", key)
        if (this.storage.hasPublicBucket)
          await this.storage.delete("public", key)
      }
    } catch (error) {
      this.activity.metrics.media.storageErrors.inc({ operation: "purge" })
      this.activity.log("media.purge_failed", null, {
        media_id: row.publicId,
        code: error instanceof StorageError ? error.code : "UNKNOWN",
      })
      // Le bail posé par claimPurges fait reprendre la purge plus tard.
      return false
    }
    await this.media.transaction(async (tx) => {
      await tx.mediaVariant.deleteMany({ where: { mediaId: id } })
      await tx.media.update({
        where: { id },
        data: { purgedAt: new Date(), url: null, nextAttemptAt: null },
      })
    })
    this.activity.metrics.media.purged.inc()
    return true
  }

  /** Toutes les clés de variantes possibles : y compris celles d'un traitement interrompu. */
  private variantKeys(publicId: string, originalKey: string): string[] {
    const extension = originalKey.slice(originalKey.lastIndexOf(".") + 1)
    return Object.values(MediaVariantKind).map((kind) =>
      variantKey(publicId, kind, kind === "PLAYBACK" ? extension : "webp"),
    )
  }

  /** Retire immédiatement les variantes publiques d'un média supprimé (le CDN cesse de les servir). */
  async unpublish(publicId: string, originalKey: string): Promise<void> {
    if (!this.storage.hasPublicBucket) return
    for (const key of this.variantKeys(publicId, originalKey)) {
      await this.storage.delete("public", key)
    }
  }

  /**
   * Objets sans média vivant : clé inconnue en base, ou média déjà purgé.
   * `dryRun` (par défaut) se contente de compter. Les objets récents et ceux
   * cités par une vérification ne sont jamais supprimés.
   */
  async scanOrphans(dryRun = true): Promise<OrphanReport> {
    const report: OrphanReport = {
      dryRun,
      scanned: 0,
      orphans: 0,
      deleted: 0,
      retained: 0,
    }
    const areas: [BucketScope, string][] = [
      ["private", "o/"],
      ["private", "q/"],
      ["private", "v/"],
    ]
    if (this.storage.hasPublicBucket) areas.push(["public", "v/"])
    const now = Date.now()

    for (const [scope, prefix] of areas) {
      let cursor: string | undefined
      do {
        const page = await this.storage.list(scope, prefix, cursor)
        cursor = page.nextCursor ?? undefined
        const candidates = page.objects.filter(
          (object) => now - object.lastModified.getTime() > ORPHAN_MIN_AGE_MS,
        )
        report.scanned += page.objects.length
        const ids = candidates.flatMap((object) => {
          const id = mediaIdOfKey(object.key)
          return id ? [id] : []
        })
        const known = await this.media.knownMedia([...new Set(ids)])
        const orphans = candidates.filter((object) => {
          const id = mediaIdOfKey(object.key)
          if (!id) return false
          const media = known.get(id)
          return !media || media.purged
        })
        const referenced = await this.media.referencedKeys(
          orphans.map((object) => object.key),
        )
        for (const object of orphans) {
          report.orphans++
          if (referenced.has(object.key)) {
            report.retained++
            continue
          }
          if (!dryRun) {
            await this.storage.delete(scope, object.key)
            report.deleted++
          }
        }
      } while (cursor)
    }
    this.activity.metrics.media.orphans.set(report.orphans - report.deleted)
    this.activity.log("media.orphan_scan", null, { ...report })
    return report
  }
}
