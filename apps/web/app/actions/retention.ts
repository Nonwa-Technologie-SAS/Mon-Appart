"use server"

import { revalidatePath } from "next/cache"

import { requireAuthPage } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"

export type RetentionActionState = { error?: string; success?: boolean }

async function guard() {
  await requireAuthPage("/profil")
}

function revalidateRetention() {
  revalidatePath("/profil")
  revalidatePath("/favoris")
}

export async function createSavedSearch(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const name = String(formData.get("name") ?? "").trim()
  const q = String(formData.get("q") ?? "").trim()
  const listingType = String(formData.get("listingType") ?? "").trim()
  const maxPrice = String(formData.get("maxPrice") ?? "").trim()
  const alertsEnabled = formData.get("alertsEnabled") !== "false"
  if (name.length < 2) return { error: "Donnez un nom à cette recherche." }
  const params: Record<string, string> = {}
  if (q) params.q = q
  const offerTypes = new Set([
    "RENT",
    "SALE",
    "SHORT_TERM_RENT",
    "LEASE_TO_OWN",
  ])
  if (listingType) {
    if (offerTypes.has(listingType.toUpperCase())) {
      params.listingType = listingType.toUpperCase()
    } else {
      params.propertyType = listingType
    }
  }
  if (maxPrice) params.maxPrice = maxPrice
  if (Object.keys(params).length === 0) {
    return { error: "Ajoutez au moins un critère." }
  }
  try {
    await nestServerFetch("/saved-searches", {
      method: "POST",
      body: { name, params, alertsEnabled, frequency: "DAILY" },
    })
    revalidateRetention()
    return { success: true }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Enregistrement impossible",
    }
  }
}

export async function updateSavedSearchAlerts(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const id = String(formData.get("savedSearchId") ?? "")
  const enabled = String(formData.get("alertsEnabled") ?? "") === "true"
  if (!id) return { error: "Recherche introuvable" }
  try {
    await nestServerFetch(`/saved-searches/${id}`, {
      method: "PATCH",
      body: {
        alertsEnabled: enabled,
        frequency: enabled ? "DAILY" : "PAUSED",
      },
    })
    revalidateRetention()
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mise à jour impossible",
    }
  }
}

export async function deleteSavedSearch(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const id = String(formData.get("savedSearchId") ?? "")
  if (!id) return { error: "Recherche introuvable" }
  try {
    await nestServerFetch(`/saved-searches/${id}`, { method: "DELETE" })
    revalidateRetention()
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Suppression impossible",
    }
  }
}

export async function resumeSavedSearch(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState & { resumePath?: string }> {
  await guard()
  const id = String(formData.get("savedSearchId") ?? "")
  if (!id) return { error: "Recherche introuvable" }
  try {
    const result = await nestServerFetch<{ resumePath: string }>(
      `/saved-searches/${id}/resume`,
      { method: "POST" },
    )
    return { success: true, resumePath: result.resumePath }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Reprise impossible",
    }
  }
}

export async function updateProjectStatus(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const projectStatus = String(formData.get("projectStatus") ?? "")
  if (!["ACTIVE", "PAUSED", "COMPLETED"].includes(projectStatus)) {
    return { error: "Statut invalide" }
  }
  try {
    await nestServerFetch("/retention/project", {
      method: "PATCH",
      body: { projectStatus },
    })
    revalidateRetention()
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mise à jour impossible",
    }
  }
}

export async function submitVisitFeedback(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const appointmentId = String(formData.get("appointmentId") ?? "")
  const outcome = String(formData.get("outcome") ?? "")
  const reason = String(formData.get("reason") ?? "")
  const privateNote = String(formData.get("privateNote") ?? "").trim()
  const shareOutcomeWithOwner = formData.get("shareOutcomeWithOwner") === "true"
  if (!appointmentId || !outcome) return { error: "Retour incomplet" }
  try {
    await nestServerFetch(`/appointments/${appointmentId}/feedback`, {
      method: "POST",
      body: {
        outcome,
        ...(reason ? { reason } : {}),
        ...(privateNote ? { privateNote } : {}),
        shareOutcomeWithOwner,
      },
    })
    revalidatePath("/profil")
    revalidatePath("/espace/visites")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Envoi impossible",
    }
  }
}

export async function updateNotificationPreferences(
  _prev: RetentionActionState,
  formData: FormData,
): Promise<RetentionActionState> {
  await guard()
  const items: Array<{
    category: string
    channel: string
    enabled: boolean
  }> = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("pref:")) continue
    const [, category, channel] = key.split(":")
    if (!category || !channel) continue
    items.push({
      category,
      channel,
      enabled: value === "on" || value === "true",
    })
  }
  if (items.length === 0) return { error: "Aucun changement" }
  try {
    await nestServerFetch("/notification-preferences", {
      method: "PUT",
      body: { items },
    })
    revalidatePath("/profil")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mise à jour impossible",
    }
  }
}
