"use server"

import { revalidatePath } from "next/cache"

import { requirePublisherPage } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"

export type ContactVerifyState = {
  error?: string
  success?: boolean
  challengeId?: string
  message?: string
}

export async function requestEmailVerification(): Promise<ContactVerifyState> {
  await requirePublisherPage("/espace/verification")
  try {
    const result = await nestServerFetch<{
      challengeId: string
      expiresAt: string
    }>("/auth/email/verify/request", { method: "POST" })
    return {
      success: true,
      challengeId: result.challengeId,
      message:
        "Code envoyé (en local, consultez la console API si AUTH_DEV_PRINT_CODES=true).",
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer le code e-mail.",
    }
  }
}

export async function confirmEmailVerification(
  _prev: ContactVerifyState,
  formData: FormData,
): Promise<ContactVerifyState> {
  await requirePublisherPage("/espace/verification")
  const code = String(formData.get("code") ?? "").trim()
  const challengeId = String(formData.get("challengeId") ?? "").trim()
  if (!code || !challengeId) {
    return { error: "Code et identifiant de défi requis." }
  }
  try {
    await nestServerFetch("/auth/email/verify/confirm", {
      method: "POST",
      body: { challengeId, code },
    })
    revalidatePath("/espace/verification")
    revalidatePath("/profil")
    return { success: true, message: "E-mail vérifié." }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Code e-mail invalide.",
    }
  }
}

export async function requestPhoneVerification(): Promise<ContactVerifyState> {
  await requirePublisherPage("/espace/verification")
  try {
    const result = await nestServerFetch<{
      challengeId: string
      expiresAt: string
    }>("/auth/phone/verify/request", { method: "POST" })
    return {
      success: true,
      challengeId: result.challengeId,
      message:
        "Code SMS envoyé (en local, consultez la console API si AUTH_DEV_PRINT_CODES=true).",
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer le code SMS.",
    }
  }
}

export async function confirmPhoneVerification(
  _prev: ContactVerifyState,
  formData: FormData,
): Promise<ContactVerifyState> {
  await requirePublisherPage("/espace/verification")
  const code = String(formData.get("code") ?? "").trim()
  const challengeId = String(formData.get("challengeId") ?? "").trim()
  if (!code || !challengeId) {
    return { error: "Code et identifiant de défi requis." }
  }
  try {
    await nestServerFetch("/auth/phone/verify/confirm", {
      method: "POST",
      body: { challengeId, code },
    })
    revalidatePath("/espace/verification")
    revalidatePath("/profil")
    return { success: true, message: "Téléphone vérifié." }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Code téléphone invalide.",
    }
  }
}
