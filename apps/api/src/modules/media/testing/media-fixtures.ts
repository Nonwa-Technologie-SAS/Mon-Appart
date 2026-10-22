import sharp from "sharp"

/** Fichiers synthétiques pour les tests : aucun fichier réel, aucune donnée personnelle. */

export function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload)
  const header = Buffer.alloc(8)
  header.writeUInt32BE(body.length + 8, 0)
  header.write(type, 4, "latin1")
  return Buffer.concat([header, body])
}

function mvhd(durationSeconds: number, timescale = 1_000): Buffer {
  const payload = Buffer.alloc(100)
  payload.writeUInt32BE(0, 0) // version 0, drapeaux
  payload.writeUInt32BE(timescale, 12)
  payload.writeUInt32BE(Math.round(durationSeconds * timescale), 16)
  return box("mvhd", payload)
}

function stsd(codec: string): Buffer {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(1, 4)
  return box("stsd", header, box(codec, Buffer.alloc(78)))
}

export interface Mp4Options {
  durationSeconds?: number
  codec?: string
  withLocation?: boolean
  brand?: string
  /** `moov` après `mdat`, comme un fichier non optimisé pour le streaming. */
  moovLast?: boolean
}

export function mp4(options: Mp4Options = {}): Buffer {
  const ftyp = box(
    "ftyp",
    Buffer.from(options.brand ?? "isom", "latin1"),
    Buffer.alloc(4),
    Buffer.from("isomavc1", "latin1"),
  )
  const trak = box(
    "trak",
    box("mdia", box("minf", box("stbl", stsd(options.codec ?? "avc1")))),
  )
  const udta = options.withLocation
    ? box("udta", box("\u00a9xyz", Buffer.from("+05.3600-004.0083/", "latin1")))
    : Buffer.alloc(0)
  const moov = box("moov", mvhd(options.durationSeconds ?? 12), trak, udta)
  const mdat = box("mdat", Buffer.alloc(2_048, 7))
  return options.moovLast
    ? Buffer.concat([ftyp, mdat, moov])
    : Buffer.concat([ftyp, moov, mdat])
}

export function webm(): Buffer {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]),
    Buffer.from("webm", "latin1"),
    Buffer.alloc(512, 1),
  ])
}

export function pdf(extra = ""): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R ${extra} >> endobj\n` +
      "2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n",
    "latin1",
  )
}

export interface ImageOptions {
  width?: number
  height?: number
  format?: "jpeg" | "png" | "webp"
  /** Orientation EXIF (1 à 8). */
  orientation?: number
  /** Ajoute des métadonnées EXIF (auteur, appareil, position GPS). */
  withExif?: boolean
}

export async function image(options: ImageOptions = {}): Promise<Buffer> {
  let pipeline = sharp({
    create: {
      width: options.width ?? 800,
      height: options.height ?? 600,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
  const format = options.format ?? "jpeg"
  pipeline =
    format === "png"
      ? pipeline.png()
      : format === "webp"
        ? pipeline.webp()
        : pipeline.jpeg({ quality: 85 })
  if (options.withExif) {
    pipeline = pipeline.withExif({
      IFD0: { Artist: "Proprietaire Test", Make: "TestCam" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "5/1 21/1 0/1" },
    })
  }
  if (options.orientation) {
    pipeline = pipeline.withMetadata({ orientation: options.orientation })
  }
  return pipeline.toBuffer()
}
