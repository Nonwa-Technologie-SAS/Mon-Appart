"use server"

import { firstZodError, requestVisitFormSchema } from "@/lib/auth-schemas"
import { getSession } from "@/lib/auth-session"
import { nestServerFetch } from "@/lib/nest-session"
import { normalizeWhatsapp } from "@/lib/visits"

export type VisitRequestState = {
  error?: string
  success?: boolean
}

export async function recordVirtualTourVisit(listingId: string) {
  if (!listingId) return { ok: false as const }

  try {
    await nestServerFetch("/interactions/views", {
      method: "POST",
      body: {
        listingId,
        source: "DIRECT",
        sessionId: crypto.randomUUID(),
      },
    })
    return { ok: true as const }
  } catch {
    return { ok: false as const }
  }
}

export async function requestPropertyVisit(
  _prev: VisitRequestState,
  formData: FormData,
): Promise<VisitRequestState> {
  const parsed = requestVisitFormSchema.safeParse({
    propertyId: formData.get("propertyId"),
    visitorName: formData.get("visitorName"),
    visitorEmail: formData.get("visitorEmail") || undefined,
    visitAt: formData.get("visitAt"),
    whatsapp: formData.get("whatsapp"),
  })

  if (!parsed.success) {
    return { error: firstZodError(parsed.error) }
  }

  const whatsapp = normalizeWhatsapp(parsed.data.whatsapp)
  if (!whatsapp) {
    return { error: "Indiquez un numéro WhatsApp valide" }
  }

  const { visitAt } = parsed.data
  if (Number.isNaN(visitAt.getTime())) {
    return { error: "Date de visite invalide" }
  }

  if (visitAt.getTime() < Date.now() - 60_000) {
    return { error: "Choisissez une date et une heure à venir" }
  }

  const session = await getSession()
  if (!session) {
    return {
      error: "Connectez-vous pour demander une visite.",
    }
  }

  try {
    await nestServerFetch("/appointments", {
      method: "POST",
      body: {
        listingId: parsed.data.propertyId,
        scheduledAt: visitAt.toISOString(),
        timezone: "Africa/Abidjan",
        notes: `WhatsApp: ${whatsapp} — ${parsed.data.visitorName}${
          parsed.data.visitorEmail ? ` (${parsed.data.visitorEmail})` : ""
        }`,
      },
    })
    return { success: true }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de planifier la visite",
    }
  }
}
