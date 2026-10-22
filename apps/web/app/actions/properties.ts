"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  createPropertySchema,
  firstZodError,
  updateOwnedPropertyStatusSchema,
} from "@/lib/auth-schemas"
import { getSession, isPublisherRole } from "@/lib/auth-session"
import { nestPublishListing, nestUpdateListingVisibility } from "@/lib/nest-publish"
import { GeocodeError } from "@/lib/geocode"
import {
  collectImageLayout,
  normalizeImageLayout,
  removePropertyImages,
  UploadError,
} from "@/lib/uploads"

export type PropertyActionState = {
  error?: string
}

export async function publishProperty(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const session = await getSession()
  if (!session) {
    return { error: "Connexion requise" }
  }
  if (!isPublisherRole(session.user.role)) {
    return {
      error: "Seuls les propriétaires et agences peuvent publier un bien",
    }
  }

  let imageLayout: ReturnType<typeof normalizeImageLayout> = []

  try {
    imageLayout = normalizeImageLayout(collectImageLayout(formData))
  } catch (error) {
    if (error instanceof UploadError) {
      return { error: error.message }
    }
    return { error: "Disposition des photos invalide" }
  }

  const parsed = createPropertySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    type: formData.get("type"),
    location: formData.get("location"),
    beds: formData.get("beds") || undefined,
    baths: formData.get("baths") || undefined,
    surface: formData.get("surface") || undefined,
    publish: true,
    imageLayout,
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  const imageUrls = imageLayout.map((item) => item.url)

  try {
    await nestPublishListing({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      type: parsed.data.type,
      location: parsed.data.location,
      beds: parsed.data.beds,
      baths: parsed.data.baths,
      surface: parsed.data.surface,
    })
    // Photos Blob : pipeline media Nest en suivi.
  } catch (error) {
    await removePropertyImages(imageUrls)
    if (error instanceof UploadError || error instanceof GeocodeError) {
      return { error: error.message }
    }
    const message =
      error instanceof Error ? error.message : "Impossible de publier le bien"
    return { error: message }
  }

  redirect("/espace?published=1")
}

export async function updatePropertyListingStatus(input: {
  propertyId: string
  status: "AVAILABLE" | "ARCHIVED"
}): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) {
    return { error: "Connexion requise" }
  }
  if (!isPublisherRole(session.user.role)) {
    return {
      error: "Seuls les propriétaires et agences peuvent modifier un bien",
    }
  }

  const parsed = updateOwnedPropertyStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await nestUpdateListingVisibility(
      parsed.data.propertyId,
      parsed.data.status === "AVAILABLE",
    )
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le statut",
    }
  }

  revalidatePath("/")
  revalidatePath("/espace")
  revalidatePath("/locations")
  revalidatePath("/annonces", "layout")
  return {}
}
