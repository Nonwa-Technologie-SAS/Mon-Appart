import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { PropertyModule } from "../property/property.module"
import { MediaAccessService } from "./application/media-access.service"
import { MediaActivity } from "./application/media-activity"
import {
  MEDIA_ATTACHMENT_ACCESS,
  MediaAttachmentService,
} from "./application/media-attachment-access"
import { MediaCleanupService } from "./application/media-cleanup.service"
import {
  MEDIA_DOCUMENT_ACCESS,
  MediaDocumentService,
} from "./application/media-document-access"
import { MediaJobRunner } from "./application/media-job-runner"
import { MediaProcessingService } from "./application/media-processing.service"
import { MediaViews } from "./application/media-views"
import { PropertyMediaService } from "./application/property-media.service"
import { UploadService } from "./application/upload.service"
import { MediaRepository } from "./infrastructure/media.repository"
import {
  DOCUMENT_SCANNER,
  NoopDocumentScanner,
} from "./infrastructure/processing/document-scanner"
import {
  LightVideoProcessor,
  VIDEO_PROCESSOR,
} from "./infrastructure/processing/video-processor"
import { OBJECT_STORAGE } from "./infrastructure/storage/object-storage"
import { objectStorageProvider } from "./infrastructure/storage/storage.factory"
import { MediaConfig } from "./media.config"
import { LocalStorageController } from "./presentation/local-storage.controller"
import { MediaUploadController } from "./presentation/media-upload.controller"
import { PropertyMediaController } from "./presentation/property-media.controller"

/**
 * Médias des biens : envoi direct présigné, vérification, traitement en file
 * (base de données), variantes, purge. Seules les métadonnées vivent dans
 * PostgreSQL ; les fichiers sont dans un stockage objet (S3, R2, disque local
 * en développement).
 */
@Module({
  imports: [IdentityModule, PropertyModule],
  controllers: [
    MediaUploadController,
    PropertyMediaController,
    LocalStorageController,
  ],
  providers: [
    MediaConfig,
    objectStorageProvider,
    { provide: VIDEO_PROCESSOR, useClass: LightVideoProcessor },
    { provide: DOCUMENT_SCANNER, useClass: NoopDocumentScanner },
    MediaRepository,
    MediaActivity,
    MediaAccessService,
    MediaViews,
    UploadService,
    MediaProcessingService,
    MediaCleanupService,
    MediaJobRunner,
    PropertyMediaService,
    MediaDocumentService,
    { provide: MEDIA_DOCUMENT_ACCESS, useExisting: MediaDocumentService },
    MediaAttachmentService,
    { provide: MEDIA_ATTACHMENT_ACCESS, useExisting: MediaAttachmentService },
  ],
  exports: [
    MEDIA_DOCUMENT_ACCESS,
    MEDIA_ATTACHMENT_ACCESS,
    OBJECT_STORAGE,
    MediaJobRunner,
    MediaCleanupService,
  ],
})
export class MediaModule {}
