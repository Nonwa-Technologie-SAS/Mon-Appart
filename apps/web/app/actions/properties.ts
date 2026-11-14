"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  createPropertySchema,
  firstZodError,
  updateOwnedListingSchema,
  updateOwnedPropertyStatusSchema,
  withdrawOwnedListingSchema,
} from "@/lib/auth-schemas"
import { getSession, isPublisherRole } from "@/lib/auth-session"
import {
  activateNestProperty,
  nestPublishListing,
  nestUpdateListingVisibility,
  nestUpdateOwnedListing,
  nestWithdrawListing,
} from "@/lib/nest-publish"
import {
  publishNestListing,
  uploadPropertyImagesToNest,
} from "@/lib/nest-media"
import { MAX_PROPERTY_IMAGES } from "@/lib/upload-constants"

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

  const photos = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (photos.length > MAX_PROPERTY_IMAGES) {
    return {
      error: `Vous pouvez ajouter au plus ${MAX_PROPERTY_IMAGES} photos`,
    }
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
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  let created: { listingId: string; propertyId: string } | null = null

  try {
    created = await nestPublishListing({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      type: parsed.data.type,
      location: parsed.data.location,
      beds: parsed.data.beds,
      baths: parsed.data.baths,
      surface: parsed.data.surface,
      publish: photos.length === 0,
    })
    if (photos.length > 0) {
      await uploadPropertyImagesToNest(created.propertyId, photos)
      await activateNestProperty(created.propertyId)
      await publishNestListing(created.listingId)
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de publier le bien"
    if (created && photos.length > 0) {
      return {
        error: `${message} L'annonce n'a pas été publiée.`,
      }
    }
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

export async function updateOwnedListing(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const session = await getSession()
  if (!session) {
    return { error: "Connexion requise" }
  }
  if (!isPublisherRole(session.user.role)) {
    return {
      error: "Seuls les propriétaires et agences peuvent modifier un bien",
    }
  }

  const parsed = updateOwnedListingSchema.safeParse({
    listingId: formData.get("listingId"),
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    location: formData.get("location"),
    beds: formData.get("beds") || undefined,
    baths: formData.get("baths") || undefined,
    surface: formData.get("surface") || undefined,
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await nestUpdateOwnedListing(parsed.data)
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les modifications",
    }
  }

  revalidatePath("/")
  revalidatePath("/espace")
  revalidatePath(`/espace/biens/${parsed.data.listingId}/modifier`)
  revalidatePath("/locations")
  revalidatePath("/annonces", "layout")
  redirect("/espace?updated=1")
}

export async function withdrawOwnedListing(input: {
  listingId: string
}): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) {
    return { error: "Connexion requise" }
  }
  if (!isPublisherRole(session.user.role)) {
    return {
      error: "Seuls les propriétaires et agences peuvent retirer un bien",
    }
  }

  const parsed = withdrawOwnedListingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  try {
    await nestWithdrawListing(parsed.data.listingId)
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de retirer l'annonce",
    }
  }

  revalidatePath("/")
  revalidatePath("/espace")
  revalidatePath("/locations")
  revalidatePath("/annonces", "layout")
  return {}
}
