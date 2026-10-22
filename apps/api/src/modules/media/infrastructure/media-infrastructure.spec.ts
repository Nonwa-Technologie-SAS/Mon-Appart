import { randomBytes, randomUUID } from "node:crypto"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"

import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { originalKey, variantKey } from "../domain/storage-keys"
import { image, mp4, webm } from "../testing/media-fixtures"
import {
  assertDecodableImage,
  processImage,
} from "./processing/image-processor"
import { LightVideoProcessor } from "./processing/video-processor"
import { safeErrorMessage } from "../../../common/http/safe-error"
import {
  LOCAL_ROUTES,
  LocalObjectStorage,
} from "./storage/local-object-storage"
import { S3ObjectStorage } from "./storage/s3-object-storage"

const MAX_PIXELS = 50_000_000

const reader = (bytes: Buffer) => async (start: number, length: number) =>
  bytes.subarray(start, start + length)

describe("processImage", () => {
  it("produit des variantes WebP sans métadonnées EXIF ni GPS", async () => {
    const input = await image({ width: 2400, height: 1600, withExif: true })
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const result = await processImage(input, "IMAGE", "image/jpeg", MAX_PIXELS)
    expect(result.variants.map((variant) => variant.spec.kind)).toEqual([
      "THUMBNAIL",
      "CARD",
      "GALLERY",
      "LARGE",
    ])
    for (const variant of result.variants) {
      const metadata = await sharp(variant.body).metadata()
      expect(metadata.format).toBe("webp")
      expect(metadata.exif).toBeUndefined()
      expect(metadata.xmp).toBeUndefined()
      expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(
        variant.spec.width,
      )
      expect(variant.body.includes(Buffer.from("Proprietaire Test"))).toBe(
        false,
      )
    }
    expect(result.variants[0]).toMatchObject({ width: 320, height: 213 })
    expect(result.variants[3]).toMatchObject({ width: 1920, height: 1280 })
  })

  it("n'agrandit jamais une petite image", async () => {
    const input = await image({ width: 500, height: 400, format: "png" })
    const result = await processImage(input, "IMAGE", "image/png", MAX_PIXELS)
    const large = result.variants.find(
      (variant) => variant.spec.kind === "LARGE",
    )
    expect(large).toMatchObject({ width: 500, height: 400 })
  })

  it("applique l'orientation EXIF", async () => {
    const input = await image({ width: 800, height: 400, orientation: 6 })
    const result = await processImage(input, "IMAGE", "image/jpeg", MAX_PIXELS)
    expect(result).toMatchObject({ width: 400, height: 800 })
    const card = result.variants.find((variant) => variant.spec.kind === "CARD")
    expect(card).toMatchObject({ width: 320, height: 640 })
  })

  it("refuse un contenu qui n'est pas du format annoncé", async () => {
    const png = await image({ format: "png" })
    await expect(
      processImage(png, "IMAGE", "image/jpeg", MAX_PIXELS),
    ).rejects.toMatchObject({
      code: "IMAGE_FORMAT_MISMATCH",
      permanent: true,
    })
  })

  it("refuse une image corrompue", async () => {
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      randomBytes(2_000),
    ])
    await expect(
      processImage(corrupt, "IMAGE", "image/jpeg", MAX_PIXELS),
    ).rejects.toMatchObject({ permanent: true })
  })

  it("refuse une image au-delà de la limite de pixels (bombe de décompression)", async () => {
    const input = await image({ width: 3000, height: 3000, format: "png" })
    await expect(
      processImage(input, "IMAGE", "image/png", 1_000_000),
    ).rejects.toMatchObject({ code: "IMAGE_TOO_MANY_PIXELS" })
  })

  it("exige le ratio 2:1 pour une photo 360°", async () => {
    const flat = await image({ width: 1200, height: 900 })
    await expect(
      processImage(flat, "IMAGE_360", "image/jpeg", MAX_PIXELS),
    ).rejects.toMatchObject({ code: "PANORAMA_RATIO_INVALID" })
    const panorama = await image({ width: 2000, height: 1000 })
    const result = await processImage(
      panorama,
      "IMAGE_360",
      "image/jpeg",
      MAX_PIXELS,
    )
    expect(result.variants[0]).toMatchObject({ width: 640, height: 320 })
  })

  it("vérifie qu'une image de document se décode", async () => {
    await expect(
      assertDecodableImage(
        await image({ format: "png" }),
        "image/png",
        MAX_PIXELS,
      ),
    ).resolves.toEqual({ width: 800, height: 600 })
    await expect(
      assertDecodableImage(
        Buffer.from("pas une image"),
        "image/png",
        MAX_PIXELS,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_UNREADABLE" })
  })
})

describe("LightVideoProcessor", () => {
  const processor = new LightVideoProcessor()

  it("accepte un MP4 H.264 court", async () => {
    const bytes = mp4({ durationSeconds: 30 })
    await expect(
      processor.check(reader(bytes), bytes.length, "video/mp4", 180),
    ).resolves.toEqual({
      durationMs: 30_000,
      codecs: ["avc1"],
      inspected: true,
    })
  })

  it.each([
    ["trop longue", mp4({ durationSeconds: 600 }), "VIDEO_TOO_LONG"],
    ["codec non lisible", mp4({ codec: "mp4v" }), "VIDEO_CODEC_UNSUPPORTED"],
    ["position GPS", mp4({ withLocation: true }), "VIDEO_HAS_LOCATION"],
  ])("refuse une vidéo %s", async (_name, bytes, code) => {
    await expect(
      processor.check(reader(bytes), bytes.length, "video/mp4", 180),
    ).rejects.toMatchObject({ code, permanent: true })
  })

  it("ne lit pas la durée d'un WebM (contrôle de signature et de taille seulement)", async () => {
    const bytes = webm()
    await expect(
      processor.check(reader(bytes), bytes.length, "video/webm", 180),
    ).resolves.toMatchObject({ inspected: false })
  })
})

describe("S3ObjectStorage (présignature, sans réseau)", () => {
  const SECRET = "fake-secret-for-unit-tests-only"
  const storage = new S3ObjectStorage({
    provider: "R2",
    endpoint: "https://account.r2.example.test",
    region: "auto",
    bucket: "private-bucket",
    publicBucket: "public-bucket",
    publicBaseUrl: "https://cdn.example.test",
    accessKeyId: "FAKEACCESSKEY",
    secretAccessKey: SECRET,
    forcePathStyle: true,
  })
  const key = originalKey(randomUUID(), "IMAGE", "jpg")

  it("signe un envoi lié à la clé, au type, à la taille et sans écrasement", async () => {
    const target = await storage.createUploadTarget(key, {
      contentType: "image/jpeg",
      contentLength: 1234,
      expiresInSeconds: 900,
    })
    const url = new URL(target.url)
    expect(url.pathname).toBe(`/private-bucket/${key}`)
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900")
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining([
        "content-length",
        "content-type",
        "host",
        "if-none-match",
      ]),
    )
    expect(target.headers).toEqual({
      "Content-Type": "image/jpeg",
      "If-None-Match": "*",
    })
    expect(target.url).not.toContain(SECRET)
  })

  it("signe une lecture courte avec le nom de fichier en pièce jointe", async () => {
    const url = new URL(
      await storage.createDownloadUrl("private", key, {
        expiresInSeconds: 300,
        contentType: "application/pdf",
        filename: "bail.pdf",
      }),
    )
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
    expect(url.searchParams.get("response-content-disposition")).toMatch(
      /^attachment;/,
    )
    expect(storage.publicUrl(variantKey(randomUUID(), "CARD", "webp"))).toMatch(
      /^https:\/\/cdn\.example\.test\/v\/[0-9a-f-]{36}\/card\.webp$/,
    )
  })

  it("refuse une clé non générée par le serveur", async () => {
    await expect(
      storage.createUploadTarget("../secret.jpg", {
        contentType: "image/jpeg",
        contentLength: 1,
        expiresInSeconds: 60,
      }),
    ).rejects.toThrow()
  })

  it("masque la signature d'une URL présignée dans un message d'erreur", async () => {
    const target = await storage.createUploadTarget(key, {
      contentType: "image/jpeg",
      contentLength: 1,
      expiresInSeconds: 60,
    })
    const signature = new URL(target.url).searchParams.get("X-Amz-Signature")!
    const message = safeErrorMessage(new Error(`échec ${target.url}`))
    expect(message).not.toContain(signature)
    expect(message).toContain("X-Amz-Signature=[redacted]")
  })
})

describe("LocalObjectStorage", () => {
  let root: string
  let storage: LocalObjectStorage
  const mediaId = randomUUID()

  const tokenOf = (url: string, route: string) => url.split(route)[1]!

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "mon-appart-media-spec-"))
    storage = new LocalObjectStorage({
      root,
      baseUrl: "http://localhost:4000",
      signingKey: randomBytes(32),
    })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const upload = async (body: Buffer, contentType = "image/jpeg") => {
    const key = originalKey(mediaId, "IMAGE", "jpg")
    const target = await storage.createUploadTarget(key, {
      contentType: "image/jpeg",
      contentLength: 10,
      expiresInSeconds: 60,
    })
    return {
      key,
      target,
      send: (data = body, type = contentType) =>
        storage.receiveUpload(
          tokenOf(target.url, LOCAL_ROUTES.upload),
          type,
          String(data.length),
          Readable.from([data]),
        ),
    }
  }

  it("reçoit un envoi signé, une seule fois", async () => {
    const { key, target, send } = await upload(Buffer.alloc(10, 1))
    expect(target).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
    })
    await send()
    expect(await storage.head("private", key)).toEqual({ size: 10 })
    await expect(send()).rejects.toMatchObject({
      code: "UPLOAD_ALREADY_RECEIVED",
    })
  })

  it("refuse un type ou une taille différents de ceux signés", async () => {
    const wrongType = await upload(Buffer.alloc(10))
    await expect(
      wrongType.send(Buffer.alloc(10), "text/html"),
    ).rejects.toMatchObject({ code: "UPLOAD_CONTENT_MISMATCH" })

    const tooBig = await upload(Buffer.alloc(10))
    await expect(
      storage.receiveUpload(
        tokenOf(tooBig.target.url, LOCAL_ROUTES.upload),
        "image/jpeg",
        undefined,
        Readable.from([Buffer.alloc(11)]),
      ),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" })

    const tooSmall = await upload(Buffer.alloc(10))
    await expect(
      storage.receiveUpload(
        tokenOf(tooSmall.target.url, LOCAL_ROUTES.upload),
        "image/jpeg",
        undefined,
        Readable.from([Buffer.alloc(4)]),
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_SIZE_MISMATCH" })
    expect(await storage.head("private", tooSmall.key)).toBeNull()
  })

  it("refuse un jeton altéré, expiré ou d'une autre opération", async () => {
    const { target } = await upload(Buffer.alloc(10))
    const token = tokenOf(target.url, LOCAL_ROUTES.upload)
    const [payload, signature] = token.split(".")
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString())
    const forged = Buffer.from(
      JSON.stringify({ ...claims, n: 999_999_999 }),
    ).toString("base64url")
    const send = (value: string) =>
      storage.receiveUpload(
        value,
        "image/jpeg",
        "10",
        Readable.from([Buffer.alloc(10)]),
      )

    await expect(send(`${forged}.${signature}`)).rejects.toMatchObject({
      code: "INVALID_UPLOAD_TOKEN",
    })
    await expect(send(`${token}.extra`)).rejects.toMatchObject({
      code: "INVALID_UPLOAD_TOKEN",
    })

    const expired = await storage.createUploadTarget(
      originalKey(mediaId, "IMAGE", "jpg"),
      {
        contentType: "image/jpeg",
        contentLength: 10,
        expiresInSeconds: -1,
      },
    )
    await expect(
      send(tokenOf(expired.url, LOCAL_ROUTES.upload)),
    ).rejects.toMatchObject({
      code: "INVALID_UPLOAD_TOKEN",
    })

    const download = await storage.createDownloadUrl(
      "private",
      originalKey(mediaId, "IMAGE", "jpg"),
      { expiresInSeconds: 60, contentType: "image/jpeg" },
    )
    await expect(
      send(tokenOf(download, LOCAL_ROUTES.download)),
    ).rejects.toMatchObject({
      code: "INVALID_UPLOAD_TOKEN",
    })
  })

  it("sert un téléchargement signé et refuse un lien d'envoi en lecture", async () => {
    const { key, target, send } = await upload(Buffer.alloc(10, 2))
    await send()
    const url = await storage.createDownloadUrl("private", key, {
      expiresInSeconds: 60,
      contentType: "application/pdf",
      filename: 'bail "signé".pdf',
    })
    const opened = await storage.openDownload(
      tokenOf(url, LOCAL_ROUTES.download),
    )
    expect(opened).toMatchObject({ size: 10, contentType: "application/pdf" })
    expect(opened.disposition).toMatch(/^attachment;/)
    opened.stream.destroy()
    await expect(
      storage.openDownload(tokenOf(target.url, LOCAL_ROUTES.upload)),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD_TOKEN" })
  })

  it("ne sert publiquement que des variantes de l'espace public", async () => {
    const key = variantKey(mediaId, "CARD", "webp")
    await storage.write("public", key, Buffer.from("webp"), {
      contentType: "image/webp",
      cacheControl: "public",
    })
    expect(storage.publicUrl(key)).toBe(
      `http://localhost:4000${LOCAL_ROUTES.public}${mediaId}/card.webp`,
    )
    const served = await storage.openPublic(key)
    expect(served?.size).toBe(4)
    served?.stream.destroy()

    const original = originalKey(mediaId, "IMAGE", "jpg")
    await storage.write("private", original, Buffer.from("x"), {
      contentType: "image/jpeg",
      cacheControl: "private",
    })
    expect(await storage.openPublic(original)).toBeNull()
    expect(
      await storage.openPublic(`v/${mediaId}/../../private/x.jpg`),
    ).toBeNull()
  })

  it("refuse toute clé hors format (traversée de répertoire)", async () => {
    await expect(
      storage.head("private", "../../../etc/passwd"),
    ).rejects.toThrow()
    await expect(
      storage.write("private", `o/${mediaId}/..\\..\\x.jpg`, Buffer.from("x"), {
        contentType: "image/jpeg",
        cacheControl: "private",
      }),
    ).rejects.toThrow()
    await expect(
      storage.createUploadTarget("o/../../x.jpg", {
        contentType: "image/jpeg",
        contentLength: 1,
        expiresInSeconds: 60,
      }),
    ).rejects.toThrow()
  })

  it("liste par préfixe sans fichiers partiels et supprime de façon idempotente", async () => {
    const { objects } = await storage.list("public", "v/")
    expect(
      objects.some(
        (object) => object.key === variantKey(mediaId, "CARD", "webp"),
      ),
    ).toBe(true)
    expect(objects.every((object) => !object.key.endsWith(".part"))).toBe(true)
    await storage.delete("public", variantKey(mediaId, "CARD", "webp"))
    await storage.delete("public", variantKey(mediaId, "CARD", "webp"))
    expect(
      await storage.head("public", variantKey(mediaId, "CARD", "webp")),
    ).toBeNull()
    expect((await readdir(root)).sort()).toEqual(["private", "public"])
  })
})
