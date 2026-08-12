"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { PropertyStatus } from "@/prisma/generated/client/enums"

export async function recordVirtualTourVisit(propertyId: string) {
  if (!propertyId) return { ok: false as const }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, status: PropertyStatus.AVAILABLE },
    select: { id: true },
  })

  if (!property) return { ok: false as const }

  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    null

  await prisma.propertyVisit.create({
    data: {
      propertyId: property.id,
      visitorName: "Visite virtuelle",
      visitDate: new Date(),
      ipAddress,
    },
  })

  return { ok: true as const }
}
