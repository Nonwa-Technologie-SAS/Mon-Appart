"use client"

import { optimizePropertyImage } from "@/lib/optimize-image"
import { MAX_PROPERTY_IMAGES, NEST_IMAGE_PREPARE_MAX } from "@/lib/upload-constants"

/** Prépare les fichiers côté navigateur. L'envoi lui-même est fait par l'action serveur vers Nest. */
export async function preparePropertyImages(files: File[]) {
  const images = files.filter((file) => file.size > 0)

  if (images.length > MAX_PROPERTY_IMAGES) {
    throw new Error(`Vous pouvez ajouter au plus ${MAX_PROPERTY_IMAGES} photos`)
  }

  const prepared: File[] = []

  for (const file of images) {
    if (file.size > NEST_IMAGE_PREPARE_MAX) {
      throw new Error("Chaque photo doit faire moins de 15 Mo")
    }

    prepared.push(await optimizePropertyImage(file))
  }

  return prepared
}
