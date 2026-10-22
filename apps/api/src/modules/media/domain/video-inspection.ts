/**
 * Lecture légère d'un conteneur MP4 / QuickTime (ISO BMFF) sans FFmpeg :
 * durée (`mvhd`), codecs déclarés (`stsd`) et présence d'une position GPS.
 * Seule la boîte `moov` est lue, par plages : jamais le fichier entier.
 */
export type RangeReader = (start: number, length: number) => Promise<Buffer>

export interface VideoInspection {
  durationMs: number | null
  codecs: string[]
  hasLocation: boolean
}

export class InvalidContainerError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "InvalidContainerError"
  }
}

/** Codecs vidéo acceptés : lisibles par les navigateurs et mobiles courants. */
export const VIDEO_CODECS = new Set([
  "avc1",
  "avc3",
  "hvc1",
  "hev1",
  "av01",
  "vp09",
])

const CONTAINERS = new Set(["trak", "mdia", "minf", "stbl", "edts", "udta"])
const MAX_TOP_LEVEL_BOXES = 1_000
// "©xyz" (QuickTime) ou clé « com.apple.quicktime.location.ISO6709 ».
const LOCATION_MARKERS = [
  Buffer.from([0xa9, 0x78, 0x79, 0x7a]),
  Buffer.from("ISO6709"),
]

interface Box {
  type: string
  start: number
  end: number
}

function* children(buffer: Buffer, start: number, end: number): Generator<Box> {
  let offset = start
  while (offset + 8 <= end) {
    const size32 = buffer.readUInt32BE(offset)
    const type = buffer.toString("latin1", offset + 4, offset + 8)
    let header = 8
    let size = size32
    if (size32 === 1) {
      if (offset + 16 > end) return
      size = Number(buffer.readBigUInt64BE(offset + 8))
      header = 16
    } else if (size32 === 0) {
      size = end - offset
    }
    if (size < header || offset + size > end) {
      throw new InvalidContainerError("VIDEO_CONTAINER_INVALID")
    }
    yield { type, start: offset + header, end: offset + size }
    offset += size
  }
}

export async function inspectIsoBmff(
  read: RangeReader,
  totalSize: number,
  maxMoovBytes = 16 * 1024 * 1024,
): Promise<VideoInspection> {
  let offset = 0
  for (let index = 0; index < MAX_TOP_LEVEL_BOXES; index++) {
    if (offset + 8 > totalSize) break
    const header = await read(offset, Math.min(16, totalSize - offset))
    const size32 = header.readUInt32BE(0)
    const type = header.toString("latin1", 4, 8)
    let headerLength = 8
    let size = size32
    if (size32 === 1) {
      if (header.length < 16) {
        throw new InvalidContainerError("VIDEO_CONTAINER_INVALID")
      }
      size = Number(header.readBigUInt64BE(8))
      headerLength = 16
    } else if (size32 === 0) {
      size = totalSize - offset
    }
    if (size < headerLength || offset + size > totalSize) {
      throw new InvalidContainerError("VIDEO_CONTAINER_INVALID")
    }
    if (type === "moov") {
      if (size > maxMoovBytes) {
        throw new InvalidContainerError("VIDEO_METADATA_TOO_LARGE")
      }
      const moov = await read(offset + headerLength, size - headerLength)
      return parseMoov(moov)
    }
    offset += size
  }
  throw new InvalidContainerError("VIDEO_CONTAINER_INVALID")
}

export function parseMoov(moov: Buffer): VideoInspection {
  let durationMs: number | null = null
  const codecs = new Set<string>()

  const walk = (start: number, end: number) => {
    for (const box of children(moov, start, end)) {
      if (box.type === "mvhd") durationMs = readDuration(moov, box)
      else if (box.type === "stsd") readSampleEntries(moov, box, codecs)
      else if (CONTAINERS.has(box.type)) walk(box.start, box.end)
    }
  }
  walk(0, moov.length)

  return {
    durationMs,
    codecs: [...codecs],
    hasLocation: LOCATION_MARKERS.some((marker) => moov.includes(marker)),
  }
}

function readDuration(buffer: Buffer, box: Box): number | null {
  const version = buffer[box.start]
  let timescale: number
  let duration: number
  if (version === 1) {
    if (box.start + 32 > box.end) return null
    timescale = buffer.readUInt32BE(box.start + 20)
    duration = Number(buffer.readBigUInt64BE(box.start + 24))
  } else {
    if (box.start + 20 > box.end) return null
    timescale = buffer.readUInt32BE(box.start + 12)
    duration = buffer.readUInt32BE(box.start + 16)
  }
  if (timescale === 0) return null
  return Math.round((duration / timescale) * 1_000)
}

function readSampleEntries(buffer: Buffer, box: Box, codecs: Set<string>) {
  // Boîte complète : version et drapeaux (4 octets), nombre d'entrées (4 octets).
  if (box.start + 8 > box.end) return
  for (const entry of children(buffer, box.start + 8, box.end)) {
    codecs.add(entry.type)
  }
}

export function hasAllowedVideoCodec(codecs: readonly string[]): boolean {
  return codecs.some((codec) => VIDEO_CODECS.has(codec))
}
