import { PropertyStatus, VisitStatus } from "@/prisma/generated/client/enums"
import { prisma } from "@/lib/prisma"

export type CreateVisitInput = {
  visitAt: Date
  whatsapp: string
  visitorName?: string
  visitorEmail?: string
}

export function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

export async function createVisitForProperty(
  propertyId: string,
  input: CreateVisitInput,
  ipAddress?: string | null
) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, status: PropertyStatus.AVAILABLE },
    select: { id: true },
  })

  if (!property) return null

  return prisma.propertyVisit.create({
    data: {
      propertyId: property.id,
      visitorName: input.visitorName || null,
      visitorEmail: input.visitorEmail || null,
      visitorWhatsapp: input.whatsapp,
      visitDate: input.visitAt,
      status: VisitStatus.PENDING,
      ipAddress: ipAddress ?? null,
    },
    select: {
      id: true,
      visitDate: true,
      visitorName: true,
      visitorEmail: true,
      visitorWhatsapp: true,
      status: true,
      createdAt: true,
    },
  })
}

export async function listVisitsForOwner(userId: string) {
  return prisma.propertyVisit.findMany({
    where: {
      property: { userId },
      visitorWhatsapp: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      visitDate: true,
      visitorName: true,
      visitorEmail: true,
      visitorWhatsapp: true,
      status: true,
      createdAt: true,
      property: {
        select: {
          id: true,
          title: true,
          location: true,
        },
      },
    },
  })
}
