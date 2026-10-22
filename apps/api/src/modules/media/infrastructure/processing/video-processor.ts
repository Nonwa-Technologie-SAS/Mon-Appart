import { rejectMedia } from "../../domain/media-errors"
import {
  hasAllowedVideoCodec,
  inspectIsoBmff,
  InvalidContainerError,
  type RangeReader,
} from "../../domain/video-inspection"

export interface VideoCheck {
  durationMs: number | null
  codecs: string[]
  inspected: boolean
}

/**
 * Contrôle d'une vidéo avant publication. L'implémentation légère lit les
 * métadonnées du conteneur sans transcoder ; une implémentation FFmpeg
 * (transcodage, miniature, suppression des métadonnées) pourra la remplacer
 * dans un worker dédié, jamais dans une requête HTTP.
 */
export interface VideoProcessor {
  readonly name: string
  check(
    read: RangeReader,
    size: number,
    mimeType: string,
    maxSeconds: number,
  ): Promise<VideoCheck>
}

export const VIDEO_PROCESSOR = Symbol("VIDEO_PROCESSOR")

export class LightVideoProcessor implements VideoProcessor {
  readonly name = "light"

  async check(
    read: RangeReader,
    size: number,
    mimeType: string,
    maxSeconds: number,
  ): Promise<VideoCheck> {
    // WebM (EBML) : signature et taille seulement, sans lecture de durée.
    if (mimeType === "video/webm") {
      return { durationMs: null, codecs: [], inspected: false }
    }
    let inspection
    try {
      inspection = await inspectIsoBmff(read, size)
    } catch (error) {
      if (error instanceof InvalidContainerError) throw rejectMedia(error.code)
      throw error
    }
    if (!hasAllowedVideoCodec(inspection.codecs)) {
      throw rejectMedia("VIDEO_CODEC_UNSUPPORTED")
    }
    // Sans transcodage, impossible d'effacer la position : on refuse plutôt que de la publier.
    if (inspection.hasLocation) throw rejectMedia("VIDEO_HAS_LOCATION")
    if (
      inspection.durationMs !== null &&
      inspection.durationMs > maxSeconds * 1_000
    ) {
      throw rejectMedia("VIDEO_TOO_LONG")
    }
    return {
      durationMs: inspection.durationMs,
      codecs: inspection.codecs,
      inspected: true,
    }
  }
}
