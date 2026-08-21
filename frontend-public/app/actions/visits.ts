"use server"

import { headers } from "next/headers"

import { firstZodError, requestVisitFormSchema } from "@/lib/auth-schemas"
import { prisma } from "@/lib/prisma"
import {
  createVisitForProperty,
  normalizeWhatsapp,
} from "@/lib/visits"
import { PropertyStatus } from "@/prisma/generated/client/enums"

export type VisitRequestState = {
  error?: string
  success?: boolean
}

async function getClientIp() {
  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  return (
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    null
  )
}

export async function recordVirtualTourVisit(propertyId: string) {
  if (!propertyId) return { ok: false as const }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, status: PropertyStatus.AVAILABLE },
    select: { id: true },
  })

  if (!property) return { ok: false as const }

  await prisma.propertyVisit.create({
    data: {
      propertyId: property.id,
      visitorName: "Visite virtuelle",
      visitorWhatsapp: "",
      visitDate: new Date(),
      ipAddress: await getClientIp(),
    },
  })

  return { ok: true as const }
}

export async function requestPropertyVisit(
  _prev: VisitRequestState,
  formData: FormData
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

  const visit = await createVisitForProperty(
    parsed.data.propertyId,
    {
      visitAt,
      whatsapp,
      visitorName: parsed.data.visitorName,
      visitorEmail: parsed.data.visitorEmail,
    },
    await getClientIp()
  )

  if (!visit) {
    return { error: "Bien introuvable" }
  }

  return { success: true }
}
