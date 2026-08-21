"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  createPropertySchema,
  firstZodError,
  updateOwnedPropertyStatusSchema,
} from "@/lib/auth-schemas"
import { getSession, isPublisherRole } from "@/lib/auth-session"
import { createPropertyForUser, updateOwnedPropertyStatus } from "@/lib/properties"
import { GeocodeError } from "@/lib/geocode"
import {
  collectImageLayout,
  normalizeImageLayout,
  removePropertyImages,
  UploadError,
} from "@/lib/uploads"
import { Role } from "@/prisma/generated/client/enums"

export type PropertyActionState = {
  error?: string
}

export async function publishProperty(
  _prev: PropertyActionState,
  formData: FormData
): Promise<PropertyActionState> {
  const session = await getSession()
  if (!session) {
    return { error: "Connexion requise" }
  }
  if (!isPublisherRole(session.user.role)) {
    return { error: "Seuls les propriétaires et agences peuvent publier un bien" }
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
    await createPropertyForUser(
      session.user.id,
      session.user.agencyId,
      {
        ...parsed.data,
        imageUrl: undefined,
        imageUrls: undefined,
        imageLayout,
      },
      randomUUID()
    )
  } catch (error) {
    await removePropertyImages(imageUrls)
    if (error instanceof UploadError || error instanceof GeocodeError) {
      return { error: error.message }
    }
    return { error: "Impossible de publier le bien" }
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
    return { error: "Seuls les propriétaires et agences peuvent modifier un bien" }
  }

  const parsed = updateOwnedPropertyStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  const asStaff =
    session.user.role === Role.ADMIN || session.user.role === Role.SUPERADMIN

  try {
    const property = await updateOwnedPropertyStatus(
      parsed.data.propertyId,
      session.user.id,
      parsed.data.status,
      asStaff
    )

    if (!property) {
      return { error: "Bien introuvable" }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return { error: "Vous ne pouvez pas modifier ce bien" }
    }
    return { error: "Impossible de mettre à jour le statut" }
  }

  revalidatePath("/")
  revalidatePath("/espace")
  revalidatePath("/recherche")
  revalidatePath(`/biens/${parsed.data.propertyId}`)
  return {}
}
