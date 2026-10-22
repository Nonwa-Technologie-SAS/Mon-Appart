import type { DownloadLink } from "../application/property-media.service"
import type { MediaView, UploadSessionView } from "../application/media-views"
import type {
  DownloadLinkResponseDto,
  MediaResponseDto,
  UploadSessionResponseDto,
} from "./dto/media-response.dto"

export function serializeMedia(view: MediaView): MediaResponseDto {
  return {
    ...view,
    createdAt: view.createdAt.toISOString(),
    readyAt: view.readyAt?.toISOString() ?? null,
  }
}

export function serializeSession(
  view: UploadSessionView,
): UploadSessionResponseDto {
  return {
    sessionId: view.sessionId,
    mediaId: view.mediaId,
    propertyId: view.propertyId,
    type: view.type,
    status: view.status,
    expiresAt: view.expiresAt?.toISOString() ?? null,
    errorCode: view.errorCode,
    ...(view.upload
      ? {
          upload: {
            url: view.upload.url,
            method: view.upload.method,
            headers: view.upload.headers,
            contentLength: view.upload.contentLength,
            expiresAt: view.upload.expiresAt.toISOString(),
          },
        }
      : {}),
    ...(view.media ? { media: serializeMedia(view.media) } : {}),
  }
}

export function serializeLink(link: DownloadLink): DownloadLinkResponseDto {
  return { url: link.url, expiresAt: link.expiresAt.toISOString() }
}
