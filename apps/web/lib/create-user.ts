import { randomUUID } from "node:crypto"

import { hashPassword } from "better-auth/crypto"

import { prisma } from "@/lib/prisma"
import { Role } from "@/prisma/generated/client/enums"

export async function createUserWithPassword(
  data: { name: string; email: string; password: string },
  role: Role,
  agencyId?: string
) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  })
  if (existing) {
    throw new Error("Un compte existe déjà avec cet email")
  }

  const userId = randomUUID()
  const hashedPassword = await hashPassword(data.password)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        name: data.name,
        email: data.email,
        emailVerified: false,
        role,
        agencyId,
      },
    })

    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
      },
    })

    return user
  })
}
