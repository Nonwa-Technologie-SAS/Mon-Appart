/**
 * Identification du format par la signature binaire (« magic bytes »). Ne
 * reconnaît que les formats de la liste autorisée : tout le reste vaut `null`.
 * Le type MIME et l'extension annoncés par le client ne sont jamais des preuves.
 */
export interface DetectedFormat {
  mime: string
  ext: string
}

/** Octets lus en tête de fichier : couvre les en-têtes ftyp, RIFF et EBML. */
export const SIGNATURE_BYTES = 4_096

const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "dash",
  "mmp4",
  "M4V ",
  "MSNV",
])
const AVIF_BRANDS = new Set(["avif", "avis"])

const ascii = (bytes: Buffer, start: number, length: number) =>
  bytes.toString("latin1", start, start + length)

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte)

export function detectFormat(bytes: Buffer): DetectedFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg" }
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" }
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mime: "image/webp", ext: "webp" }
  }
  if (ascii(bytes, 0, 5) === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf" }
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    // EBML : Matroska et WebM partagent l'en-tête, seul le DocType les distingue.
    return ascii(bytes, 0, Math.min(bytes.length, 64)).includes("webm")
      ? { mime: "video/webm", ext: "webm" }
      : null
  }
  if (ascii(bytes, 4, 4) === "ftyp" && bytes.length >= 12) {
    const brand = ascii(bytes, 8, 4)
    if (AVIF_BRANDS.has(brand)) return { mime: "image/avif", ext: "avif" }
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov" }
    if (MP4_BRANDS.has(brand)) return { mime: "video/mp4", ext: "mp4" }
  }
  return null
}
