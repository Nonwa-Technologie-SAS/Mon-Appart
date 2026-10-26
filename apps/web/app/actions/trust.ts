"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"

export type TrustActionState = { error?: string; success?: boolean }

const LISTING_REASONS = new Set([
  "SUSPECTED_SCAM",
  "DUPLICATE_LISTING",
  "INCORRECT_PRICE",
  "PROPERTY_NOT_AVAILABLE",
  "UNAUTHORIZED_LISTING",
  "MISLEADING_INFORMATION",
  "INAPPROPRIATE_CONTENT",
  "OTHER",
])

const CONVERSATION_REASONS = new Set([
  "SUSPECTED_SCAM",
  "MISLEADING_INFORMATION",
  "INAPPROPRIATE_CONTENT",
  "OTHER",
])

function asReason(value: string, allowed: Set<string>) {
  return allowed.has(value) ? value : null
}

export async function reportListing(
  _prev: TrustActionState,
  formData: FormData,
): Promise<TrustActionState> {
  const session = await getSession()
  if (!session) {
    return { error: "Connectez-vous pour signaler une annonce." }
  }
  const listingId = String(formData.get("listingId") ?? "")
  const reason = asReason(String(formData.get("reason") ?? ""), LISTING_REASONS)
  const description = String(formData.get("description") ?? "").trim()
  if (!/^[0-9a-f-]{36}$/i.test(listingId) || !reason) {
    return { error: "Choisissez un motif de signalement." }
  }
  try {
    await nestServerFetch("/trust/reports", {
      method: "POST",
      body: {
        targetType: "LISTING",
        listingId,
        reason,
        ...(description ? { description: description.slice(0, 1000) } : {}),
      },
    })
    revalidatePath("/annonces")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Signalement impossible",
    }
  }
}

export async function reportConversation(
  _prev: TrustActionState,
  formData: FormData,
): Promise<TrustActionState> {
  const session = await getSession()
  if (!session) {
    return { error: "Connectez-vous pour signaler une conversation." }
  }
  const conversationId = String(formData.get("conversationId") ?? "")
  const inquiryId = String(formData.get("inquiryId") ?? "")
  const messageId = String(formData.get("messageId") ?? "").trim()
  const reason = asReason(
    String(formData.get("reason") ?? ""),
    CONVERSATION_REASONS,
  )
  const description = String(formData.get("description") ?? "").trim()
  if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !reason) {
    return { error: "Choisissez un motif de signalement." }
  }
  try {
    await nestServerFetch(`/conversations/${conversationId}/report`, {
      method: "POST",
      body: {
        reason,
        ...(messageId && /^[0-9a-f-]{36}$/i.test(messageId)
          ? { messageId }
          : {}),
        ...(description ? { description: description.slice(0, 1000) } : {}),
      },
    })
    if (inquiryId) revalidatePath(`/espace/demandes/${inquiryId}`)
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Signalement impossible",
    }
  }
}
