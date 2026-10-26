"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requirePublisherPage } from "@/lib/auth-session"
import {
  createVerification,
  removeVerificationDocument,
  submitVerification,
  withdrawVerification,
  type VerificationType,
} from "@/lib/nest-trust"

export type VerificationActionState = {
  error?: string
  success?: boolean
}

const REQUESTABLE: VerificationType[] = [
  "IDENTITY",
  "AGENCY",
  "PROPERTY_OWNERSHIP",
  "OWNER_AUTHORIZATION",
  "PROPERTY_DOCUMENT",
]

export async function startVerification(
  _prev: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  await requirePublisherPage("/espace/verification")

  const type = String(formData.get("type") ?? "") as VerificationType
  if (!REQUESTABLE.includes(type)) {
    return { error: "Type de vérification invalide." }
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim() || undefined
  const claimedRelation =
    String(formData.get("claimedRelation") ?? "").trim() || undefined
  const agencyName = String(formData.get("agencyName") ?? "").trim() || undefined
  const statement = String(formData.get("statement") ?? "").trim() || undefined

  if (
    (type === "PROPERTY_OWNERSHIP" ||
      type === "OWNER_AUTHORIZATION" ||
      type === "PROPERTY_DOCUMENT") &&
    !propertyId
  ) {
    return { error: "Sélectionnez le bien concerné." }
  }
  if (type === "PROPERTY_OWNERSHIP" && !claimedRelation) {
    return { error: "Indiquez le type de rattachement (propriétaire…)." }
  }
  if (type === "OWNER_AUTHORIZATION" && !claimedRelation) {
    return { error: "Indiquez le type de mandat." }
  }
  if (type === "AGENCY" && !agencyName) {
    return { error: "Indiquez la raison sociale de l’agence." }
  }

  let createdId: string
  try {
    const created = await createVerification({
      type,
      propertyId,
      claimedRelation,
      declaration:
        agencyName || statement
          ? { agencyName, statement }
          : undefined,
    })
    createdId = created.id
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible d’ouvrir le dossier.",
    }
  }
  revalidatePath("/espace/verification")
  redirect(`/espace/verification/${createdId}`)
}

export async function submitMyVerification(
  verificationId: string,
): Promise<VerificationActionState> {
  await requirePublisherPage("/espace/verification")
  try {
    await submitVerification(verificationId)
    revalidatePath("/espace/verification")
    revalidatePath(`/espace/verification/${verificationId}`)
    return { success: true }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Soumission impossible. Vérifiez les pièces et l’identité.",
    }
  }
}

export async function withdrawMyVerification(
  verificationId: string,
): Promise<VerificationActionState> {
  await requirePublisherPage("/espace/verification")
  try {
    await withdrawVerification(verificationId)
    revalidatePath("/espace/verification")
    revalidatePath(`/espace/verification/${verificationId}`)
    return { success: true }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Retrait impossible.",
    }
  }
}

export async function deleteMyVerificationDocument(
  verificationId: string,
  documentId: string,
): Promise<VerificationActionState> {
  await requirePublisherPage("/espace/verification")
  try {
    await removeVerificationDocument(verificationId, documentId)
    revalidatePath(`/espace/verification/${verificationId}`)
    return { success: true }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Suppression impossible.",
    }
  }
}
