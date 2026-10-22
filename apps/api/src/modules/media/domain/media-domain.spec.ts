import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { mp4, pdf, webm } from "../testing/media-fixtures"
import { detectFormat } from "./file-signature"
import { mediaError } from "./media-errors"
import {
  isEquirectangular,
  isPrimaryEligible,
  isPubliclyListable,
  resolveVisibility,
  sanitizeFilename,
  signatureMatches,
  validateDeclaration,
  type MediaLimits,
} from "./media-policy"
import { canTransition, isPastUpload, retryDelayMs } from "./media-status"
import { inspectPdf } from "./pdf-inspection"
import {
  assertSafeKey,
  isSafeKey,
  mediaIdOfKey,
  originalKey,
  variantKey,
} from "./storage-keys"
import { inspectIsoBmff, InvalidContainerError } from "./video-inspection"

const LIMITS: MediaLimits = {
  imageBytes: 15 * 1024 * 1024,
  videoBytes: 200 * 1024 * 1024,
  documentBytes: 20 * 1024 * 1024,
  imagePixels: 50_000_000,
  videoSeconds: 180,
  perProperty: 30,
  pendingUploads: 20,
}

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return undefined
}

const reader = (bytes: Buffer) => async (start: number, length: number) =>
  bytes.subarray(start, start + length)

describe("detectFormat", () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), "image/jpeg"],
    [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      "image/png",
    ],
    [Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"), "image/webp"],
    [pdf(), "application/pdf"],
    [mp4(), "video/mp4"],
    [mp4({ brand: "qt  " }), "video/quicktime"],
    [mp4({ brand: "avif" }), "image/avif"],
    [webm(), "video/webm"],
  ])("reconnaît la signature %#", (bytes, mime) => {
    expect(detectFormat(bytes)?.mime).toBe(mime)
  })

  it.each([
    ["texte", Buffer.from("hello world, je suis un jpeg")],
    ["html", Buffer.from("<html><script>alert(1)</script>")],
    ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["gif", Buffer.from("GIF89a\0\0")],
    ["heic", mp4({ brand: "heic" })],
    ["matroska", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x88])],
    ["vide", Buffer.alloc(0)],
  ])("refuse un format hors liste (%s)", (_name, bytes) => {
    expect(detectFormat(bytes)).toBeNull()
  })
})

describe("validateDeclaration", () => {
  it("accepte une photo JPEG déclarée correctement", () => {
    expect(
      validateDeclaration(
        {
          type: "IMAGE",
          mimeType: " IMAGE/JPEG ",
          size: 1_000,
          filename: "salon.JPG",
        },
        LIMITS,
      ),
    ).toEqual({ mimeType: "image/jpeg" })
  })

  it.each([
    [
      "type non autorisé",
      { type: "IMAGE", mimeType: "image/svg+xml", size: 10 },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "HEIC",
      { type: "IMAGE", mimeType: "image/heic", size: 10 },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "PDF déclaré comme photo",
      { type: "IMAGE", mimeType: "application/pdf", size: 10 },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "extension trompeuse",
      {
        type: "IMAGE",
        mimeType: "image/jpeg",
        size: 10,
        filename: "photo.php",
      },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "double extension",
      {
        type: "IMAGE",
        mimeType: "image/png",
        size: 10,
        filename: "photo.png.exe",
      },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "taille nulle",
      { type: "IMAGE", mimeType: "image/png", size: 0 },
      "INVALID_MEDIA_REQUEST",
    ],
    [
      "taille non entière",
      { type: "IMAGE", mimeType: "image/png", size: 1.5 },
      "INVALID_MEDIA_REQUEST",
    ],
    [
      "image trop lourde",
      { type: "IMAGE", mimeType: "image/png", size: LIMITS.imageBytes + 1 },
      "FILE_TOO_LARGE",
    ],
    [
      "vidéo trop lourde",
      { type: "VIDEO", mimeType: "video/mp4", size: LIMITS.videoBytes + 1 },
      "FILE_TOO_LARGE",
    ],
  ] as const)("refuse : %s", (_name, declaration, code) => {
    expect(codeOf(() => validateDeclaration(declaration, LIMITS))).toBe(code)
  })

  it("compare la signature détectée au type annoncé et autorisé", () => {
    expect(signatureMatches("IMAGE", "image/jpeg", "image/jpeg")).toBe(true)
    expect(signatureMatches("IMAGE", "image/jpeg", "image/png")).toBe(false)
    expect(signatureMatches("IMAGE", "image/jpeg", null)).toBe(false)
    expect(signatureMatches("IMAGE_360", "image/png", "image/png")).toBe(false)
  })
})

describe("politique des médias", () => {
  it("nettoie le nom d'origine sans jamais le réutiliser comme chemin", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd")
    expect(sanitizeFilename("C:\\Users\\a\\photo<1>.jpg")).toBe("photo1.jpg")
    expect(sanitizeFilename("..")).toBeNull()
    expect(sanitizeFilename("a\u0000b.png")).toBe("ab.png")
    expect(sanitizeFilename("x".repeat(400))?.length).toBe(255)
  })

  it("rend toujours un document privé", () => {
    expect(resolveVisibility("DOCUMENT", "PUBLIC")).toBe("PRIVATE")
    expect(resolveVisibility("IMAGE")).toBe("PUBLIC")
    expect(resolveVisibility("VIDEO", "PRIVATE")).toBe("PRIVATE")
  })

  it("n'expose que les médias prêts, publics et non supprimés", () => {
    const ready = {
      status: "READY",
      visibility: "PUBLIC",
      deletedAt: null,
    } as const
    expect(isPubliclyListable(ready)).toBe(true)
    expect(isPubliclyListable({ ...ready, status: "PROCESSING" })).toBe(false)
    expect(isPubliclyListable({ ...ready, visibility: "PRIVATE" })).toBe(false)
    expect(isPubliclyListable({ ...ready, deletedAt: new Date() })).toBe(false)
    expect(isPrimaryEligible({ ...ready, type: "IMAGE_360" })).toBe(true)
    expect(isPrimaryEligible({ ...ready, type: "VIDEO" })).toBe(false)
  })

  it("contrôle le ratio d'une photo 360°", () => {
    expect(isEquirectangular(4096, 2048)).toBe(true)
    expect(isEquirectangular(4000, 3000)).toBe(false)
  })
})

describe("clés de stockage", () => {
  const id = randomUUID()

  it("génère des clés imprévisibles, sous le bon préfixe", () => {
    const first = originalKey(id, "IMAGE", "jpg")
    const second = originalKey(id, "IMAGE", "jpg")
    expect(first).not.toBe(second)
    expect(first.startsWith(`o/${id}/`)).toBe(true)
    expect(originalKey(id, "DOCUMENT", "pdf").startsWith(`q/${id}/`)).toBe(true)
    expect(variantKey(id, "THUMBNAIL", "webp")).toBe(`v/${id}/thumbnail.webp`)
    expect(mediaIdOfKey(first)).toBe(id)
  })

  it.each([
    `o/${id}/../../../etc/passwd`,
    `/o/${id}/abc.jpg`,
    `o/${id}/abc.jpg/../x.jpg`,
    `o\\${id}\\abc.jpg`,
    `x/${id}/abc.jpg`,
    `o/not-a-uuid/abc.jpg`,
    `o/${id}/ABC.jpg`,
    `o/${id}/abc.jpg\u0000.png`,
    `o/${id}/abc`,
  ])("refuse une clé dangereuse : %s", (key) => {
    expect(isSafeKey(key)).toBe(false)
    expect(() => assertSafeKey(key)).toThrow()
    expect(mediaIdOfKey(key)).toBeNull()
  })

  it("refuse une extension fournie avec un chemin", () => {
    expect(() => originalKey(id, "IMAGE", "jpg/../x")).toThrow()
  })
})

describe("cycle de vie", () => {
  it("n'autorise que les transitions prévues", () => {
    expect(canTransition("PENDING_UPLOAD", "UPLOADED")).toBe(true)
    expect(canTransition("PENDING_UPLOAD", "READY")).toBe(false)
    expect(canTransition("UPLOADED", "READY")).toBe(false)
    expect(canTransition("PROCESSING", "UPLOADED")).toBe(true)
    expect(canTransition("READY", "PROCESSING")).toBe(false)
    expect(canTransition("REJECTED", "UPLOADED")).toBe(false)
    expect(isPastUpload("PENDING_UPLOAD")).toBe(false)
    expect(isPastUpload("READY")).toBe(true)
  })

  it("espace les nouveaux essais, avec un plafond", () => {
    expect(retryDelayMs(1)).toBe(30_000)
    expect(retryDelayMs(2)).toBe(60_000)
    expect(retryDelayMs(3)).toBe(120_000)
    expect(retryDelayMs(50)).toBe(30 * 60_000)
  })

  it("produit des erreurs au code stable et au statut HTTP prévu", () => {
    const error = mediaError("UPLOAD_SESSION_EXPIRED")
    expect(error.code).toBe("UPLOAD_SESSION_EXPIRED")
    expect(error.getStatus()).toBe(410)
    expect(mediaError("FILE_TOO_LARGE", "maximum 10 octets").message).toContain(
      "maximum 10 octets",
    )
  })
})

describe("inspection vidéo (MP4 / MOV)", () => {
  it("lit la durée et les codecs sans lire tout le fichier", async () => {
    const bytes = mp4({ durationSeconds: 42.5, codec: "avc1" })
    const result = await inspectIsoBmff(reader(bytes), bytes.length)
    expect(result).toEqual({
      durationMs: 42_500,
      codecs: ["avc1"],
      hasLocation: false,
    })
  })

  it("trouve moov placé après mdat", async () => {
    const bytes = mp4({ moovLast: true, codec: "hvc1" })
    const result = await inspectIsoBmff(reader(bytes), bytes.length)
    expect(result.codecs).toEqual(["hvc1"])
  })

  it("détecte une position GPS embarquée", async () => {
    const bytes = mp4({ withLocation: true })
    const result = await inspectIsoBmff(reader(bytes), bytes.length)
    expect(result.hasLocation).toBe(true)
  })

  it("refuse un conteneur tronqué ou incohérent", async () => {
    const bytes = mp4()
    const truncated = bytes.subarray(0, 40)
    await expect(
      inspectIsoBmff(reader(truncated), truncated.length),
    ).rejects.toBeInstanceOf(InvalidContainerError)
    const corrupt = Buffer.from(bytes)
    corrupt.writeUInt32BE(3, 0)
    await expect(
      inspectIsoBmff(reader(corrupt), corrupt.length),
    ).rejects.toBeInstanceOf(InvalidContainerError)
  })

  it("refuse une boîte moov démesurée", async () => {
    const bytes = mp4()
    await expect(
      inspectIsoBmff(reader(bytes), bytes.length, 16),
    ).rejects.toMatchObject({
      code: "VIDEO_METADATA_TOO_LARGE",
    })
  })
})

describe("inspection PDF", () => {
  it("accepte un PDF simple", () => {
    expect(inspectPdf(pdf())).toEqual({ valid: true, activeContent: [] })
  })

  it("détecte le contenu actif, même échappé", () => {
    expect(
      inspectPdf(pdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"))
        .activeContent,
    ).toEqual(["/JavaScript", "/JS"])
    expect(inspectPdf(pdf("/J#61vaScript (x)")).activeContent).toEqual([
      "/JavaScript",
    ])
    expect(inspectPdf(pdf("/Launch << /F (cmd.exe) >>")).activeContent).toEqual(
      ["/Launch"],
    )
    expect(inspectPdf(pdf("/EmbeddedFiles << >>")).activeContent).toEqual([])
    expect(inspectPdf(pdf("/EmbeddedFile << >>")).activeContent).toEqual([
      "/EmbeddedFile",
    ])
  })

  it("refuse un fichier tronqué ou sans en-tête", () => {
    expect(inspectPdf(pdf().subarray(0, 30)).valid).toBe(false)
    expect(inspectPdf(Buffer.from("hello %%EOF")).valid).toBe(false)
  })
})
