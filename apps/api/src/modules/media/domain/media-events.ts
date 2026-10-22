/**
 * Événements publiés après commit. Charges utiles : identifiants publics,
 * type et statut ; jamais de clé de stockage, d'URL signée ni de nom de fichier.
 */
export const MediaEvent = {
  UPLOAD_STARTED: "media.upload_started",
  UPLOADED: "media.uploaded",
  READY: "media.ready",
  REJECTED: "media.rejected",
  FAILED: "media.failed",
  DELETED: "media.deleted",
  /** Médias visibles d'un bien modifiés (ajout, ordre, image principale, suppression). */
  PROPERTY_MEDIA_CHANGED: "property.media_changed",
} as const

export const MediaAuditAction = {
  UPLOAD_STARTED: "MEDIA_UPLOAD_STARTED",
  REORDERED: "MEDIA_REORDERED",
  PRIMARY_CHANGED: "MEDIA_PRIMARY_CHANGED",
  DELETED: "MEDIA_DELETED",
  DOCUMENT_ACCESSED: "MEDIA_DOCUMENT_ACCESSED",
  ATTACHMENT_ACCESSED: "MEDIA_ATTACHMENT_ACCESSED",
} as const

export const MEDIA_ENTITY = "media"
