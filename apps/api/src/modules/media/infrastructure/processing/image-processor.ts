import sharp, { type Metadata } from "sharp"

import type { MediaType } from "../../../../generated/prisma/enums"
import { rejectMedia } from "../../domain/media-errors"
import {
  isEquirectangular,
  variantsFor,
  type VariantSpec,
} from "../../domain/media-policy"

export interface ProcessedVariant {
  spec: VariantSpec
  body: Buffer
  width: number
  height: number
}

export interface ProcessedImage {
  /** Dimensions après correction de l'orientation EXIF. */
  width: number
  height: number
  sourceFormat: string
  variants: ProcessedVariant[]
}

const FORMATS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "heif",
}

const WEBP_QUALITY = 80

// Chaque image n'est traitée qu'une fois : le cache de Sharp ne ferait que garder de la mémoire.
sharp.cache(false)

/**
 * Normalise une photo : décodage borné (`limitInputPixels`), orientation
 * appliquée, métadonnées (EXIF, GPS, XMP, ICC hors sRGB) supprimées par
 * réencodage, variantes WebP sans agrandissement.
 */
export async function processImage(
  input: Buffer,
  type: MediaType,
  mimeType: string,
  maxPixels: number,
): Promise<ProcessedImage> {
  const options = { limitInputPixels: maxPixels, failOn: "error" as const }
  let metadata: Metadata
  try {
    metadata = await sharp(input, options).metadata()
  } catch (error) {
    throw rejectMedia(
      /pixel limit/i.test(String(error))
        ? "IMAGE_TOO_MANY_PIXELS"
        : "IMAGE_UNREADABLE",
    )
  }
  if (metadata.format !== FORMATS[mimeType]) {
    throw rejectMedia("IMAGE_FORMAT_MISMATCH")
  }
  if (!metadata.width || !metadata.height) {
    throw rejectMedia("IMAGE_UNREADABLE")
  }
  if (metadata.width * metadata.height > maxPixels) {
    throw rejectMedia("IMAGE_TOO_MANY_PIXELS")
  }
  if ((metadata.pages ?? 1) > 1) throw rejectMedia("IMAGE_ANIMATED")

  // Orientations 5 à 8 : l'image affichée est tournée d'un quart de tour.
  const swapped = (metadata.orientation ?? 1) >= 5
  const width = swapped ? metadata.height : metadata.width
  const height = swapped ? metadata.width : metadata.height
  if (type === "IMAGE_360" && !isEquirectangular(width, height)) {
    throw rejectMedia("PANORAMA_RATIO_INVALID")
  }

  const variants: ProcessedVariant[] = []
  for (const spec of variantsFor(type)) {
    try {
      const { data, info } = await sharp(input, options)
        .rotate()
        .resize({
          width: spec.width,
          height: spec.height,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toColourspace("srgb")
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      variants.push({
        spec,
        body: data,
        width: info.width,
        height: info.height,
      })
    } catch {
      throw rejectMedia("IMAGE_UNREADABLE")
    }
  }

  return {
    width,
    height,
    sourceFormat: metadata.format,
    variants,
  }
}

/** Image d'un document : vérifie qu'elle se décode, sans la modifier. */
export async function assertDecodableImage(
  input: Buffer,
  mimeType: string,
  maxPixels: number,
): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(input, {
      limitInputPixels: maxPixels,
      failOn: "error",
    }).metadata()
    if (
      metadata.format !== FORMATS[mimeType] ||
      !metadata.width ||
      !metadata.height
    ) {
      throw rejectMedia("DOCUMENT_UNREADABLE")
    }
    await sharp(input, { limitInputPixels: maxPixels, failOn: "error" })
      .resize(64)
      .toBuffer()
    return { width: metadata.width, height: metadata.height }
  } catch (error) {
    if (error instanceof Error && error.name === "MediaProcessingError")
      throw error
    throw rejectMedia("DOCUMENT_UNREADABLE")
  }
}
