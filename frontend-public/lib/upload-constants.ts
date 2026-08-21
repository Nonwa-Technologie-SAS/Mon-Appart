export const MAX_PROPERTY_IMAGES = 10
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024

/** Under Vercel’s 4.5 MB function payload limit, after client compression. */
export const FUNCTION_UPLOAD_MAX = 4 * 1024 * 1024

/** Longest edge kept for listing photos (Booking / Airbnb style). */
export const IMAGE_MAX_EDGE = 2560

/** Visually lossless WebP quality used by large photo platforms. */
export const IMAGE_QUALITY = 0.86

export const IMAGE_OUTPUT_TYPE = "image/webp" as const
export const IMAGE_FALLBACK_TYPE = "image/jpeg" as const

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const
