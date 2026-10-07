"use client"

import {
  IMAGE_FALLBACK_TYPE,
  IMAGE_MAX_EDGE,
  IMAGE_OUTPUT_TYPE,
  IMAGE_QUALITY,
} from "@/lib/upload-constants"

function outputName(name: string, extension: "webp" | "jpg") {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${base || "photo"}.${extension}`
}

function scaledSize(width: number, height: number) {
  const longest = Math.max(width, height)
  if (longest <= IMAGE_MAX_EDGE) {
    return { width, height }
  }

  const scale = IMAGE_MAX_EDGE / longest
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

async function loadHtmlImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = "async"
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Impossible de lire cette image"))
      image.src = objectUrl
    })
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      // HEIC or unsupported decode — try the HTML image path.
    }
  }

  return loadHtmlImage(file)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

export async function optimizePropertyImage(file: File) {
  const source = await decodeImage(file)
  const { width, height } = scaledSize(source.width, source.height)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Impossible d’optimiser cette image")
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(source, 0, 0, width, height)

  if ("close" in source) {
    source.close()
  }

  const webp = await canvasToBlob(canvas, IMAGE_OUTPUT_TYPE, IMAGE_QUALITY)
  const jpeg = await canvasToBlob(canvas, IMAGE_FALLBACK_TYPE, IMAGE_QUALITY)
  const optimized = webp && webp.size > 0 ? webp : jpeg

  if (!optimized) {
    throw new Error("Impossible d’optimiser cette image")
  }

  const alreadyLight =
    file.size <= optimized.size &&
    (file.type === IMAGE_OUTPUT_TYPE || file.type === IMAGE_FALLBACK_TYPE) &&
    file.size <= 800 * 1024

  if (alreadyLight) {
    return file
  }

  const extension = optimized.type === IMAGE_OUTPUT_TYPE ? "webp" : "jpg"
  return new File([optimized], outputName(file.name, extension), {
    type: optimized.type,
    lastModified: Date.now(),
  })
}
