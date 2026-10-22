"use client"

import { optimizePropertyImage } from "@/lib/optimize-image"
import { FUNCTION_UPLOAD_MAX, MAX_IMAGE_SIZE, MAX_PROPERTY_IMAGES } from "@/lib/upload-constants"

export async function uploadPropertyImages(files: File[]) {
  const images = files.filter((file) => file.size > 0)

  if (images.length > MAX_PROPERTY_IMAGES) {
    throw new Error(`Vous pouvez ajouter au plus ${MAX_PROPERTY_IMAGES} photos`)
  }

  const urls: string[] = []

  for (const file of images) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("Chaque photo doit faire moins de 8 Mo")
    }

    const optimized = await optimizePropertyImage(file)
    if (optimized.size > FUNCTION_UPLOAD_MAX) {
      throw new Error("Cette photo est encore trop lourde après optimisation")
    }

    const form = new FormData()
    form.append("file", optimized)

    const response = await fetch("/api/blob/put", {
      method: "POST",
      body: form,
    })
    const json = (await response.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null

    if (!response.ok || !json?.url) {
      throw new Error(json?.error ?? "Impossible d’envoyer la photo vers le stockage")
    }

    urls.push(json.url)
  }

  return urls
}
