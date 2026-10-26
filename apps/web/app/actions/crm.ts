"use server"

import { revalidatePath } from "next/cache"

import { getSession, requirePublisherPage } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"

export type CrmActionState = { error?: string; success?: boolean }

async function guard() {
  await requirePublisherPage("/espace")
}

export async function updateInquiryStage(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await guard()
  const inquiryId = String(formData.get("inquiryId") ?? "")
  const stage = String(formData.get("stage") ?? "")
  const lostReason = String(formData.get("lostReason") ?? "") || undefined
  if (!inquiryId || !stage) return { error: "Demande incomplète" }
  try {
    await nestServerFetch(`/inquiries/${inquiryId}`, {
      method: "PATCH",
      body: {
        stage,
        ...(stage === "LOST" ? { lostReason: lostReason ?? "OTHER" } : {}),
      },
    })
    revalidatePath("/espace/demandes")
    revalidatePath(`/espace/demandes/${inquiryId}`)
    revalidatePath("/espace")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mise à jour impossible",
    }
  }
}

export async function updateInquiryFollowUp(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await guard()
  const inquiryId = String(formData.get("inquiryId") ?? "")
  const nextAction = String(formData.get("nextAction") ?? "").trim()
  const nextActionAt = String(formData.get("nextActionAt") ?? "")
  const budgetRaw = String(formData.get("budgetAmount") ?? "").trim()
  const desiredZone = String(formData.get("desiredZone") ?? "").trim()
  if (!inquiryId) return { error: "Demande introuvable" }
  const budgetAmount = budgetRaw
    ? Number.parseInt(budgetRaw.replace(/\s/g, ""), 10)
    : null
  if (budgetRaw && (budgetAmount === null || Number.isNaN(budgetAmount))) {
    return { error: "Budget invalide" }
  }
  try {
    await nestServerFetch(`/inquiries/${inquiryId}`, {
      method: "PATCH",
      body: {
        nextAction: nextAction || null,
        nextActionAt: nextActionAt
          ? new Date(nextActionAt).toISOString()
          : null,
        budgetAmount,
        desiredZone: desiredZone || null,
      },
    })
    revalidatePath(`/espace/demandes/${inquiryId}`)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mise à jour impossible",
    }
  }
}

export async function addInquiryNote(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await guard()
  const inquiryId = String(formData.get("inquiryId") ?? "")
  const body = String(formData.get("body") ?? "").trim()
  if (!inquiryId || body.length < 2) {
    return { error: "Écrivez une note d’au moins 2 caractères" }
  }
  try {
    await nestServerFetch(`/inquiries/${inquiryId}/notes`, {
      method: "POST",
      body: { body },
    })
    revalidatePath(`/espace/demandes/${inquiryId}`)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Note non enregistrée",
    }
  }
}

export async function actOnVisit(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await guard()
  const appointmentId = String(formData.get("appointmentId") ?? "")
  const action = String(formData.get("action") ?? "")
  const reason = String(formData.get("reason") ?? "OTHER")
  const scheduledAt = String(formData.get("scheduledAt") ?? "")
  if (!appointmentId || !action) return { error: "Action incomplète" }
  const path =
    action === "CONFIRM"
      ? `/appointments/${appointmentId}/confirm`
      : action === "CANCEL"
        ? `/appointments/${appointmentId}/cancel`
        : action === "COMPLETE"
          ? `/appointments/${appointmentId}/complete`
          : action === "NO_SHOW"
            ? `/appointments/${appointmentId}/no-show`
            : action === "RESCHEDULE"
              ? `/appointments/${appointmentId}/reschedule`
              : null
  if (!path) return { error: "Action inconnue" }
  try {
    await nestServerFetch(path, {
      method: "POST",
      body:
        action === "CANCEL"
          ? { reason }
          : action === "RESCHEDULE"
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {},
    })
    revalidatePath("/espace")
    revalidatePath("/espace/visites")
    revalidatePath("/espace/demandes")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Action impossible",
    }
  }
}

export async function sendListingMessage(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  const listingId = String(formData.get("listingId") ?? "")
  const message = String(formData.get("message") ?? "").trim()
  const budgetRaw = String(formData.get("budgetAmount") ?? "").trim()
  if (!listingId || message.length < 4) {
    return { error: "Écrivez un message d’au moins quelques mots." }
  }
  const session = await getSession()
  if (!session) {
    return { error: "Connectez-vous pour envoyer un message." }
  }
  try {
    const budget = budgetRaw ? `Budget : ${budgetRaw} FCFA. ` : ""
    await nestServerFetch("/conversations", {
      method: "POST",
      body: { listingId, message: `${budget}${message}` },
    })
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Message non envoyé",
    }
  }
}

export async function replyToConversation(
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  await guard()
  const conversationId = String(formData.get("conversationId") ?? "")
  const inquiryId = String(formData.get("inquiryId") ?? "")
  const body = String(formData.get("body") ?? "").trim()
  if (!conversationId || body.length < 1) {
    return { error: "Écrivez un message" }
  }
  try {
    await nestServerFetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body, clientMessageId: crypto.randomUUID() },
    })
    revalidatePath("/espace/demandes")
    if (inquiryId) revalidatePath(`/espace/demandes/${inquiryId}`)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Message non envoyé",
    }
  }
}
