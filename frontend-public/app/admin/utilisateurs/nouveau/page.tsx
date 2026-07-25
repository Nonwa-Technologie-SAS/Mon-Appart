import { redirect } from "next/navigation"

import { CreateStaffForm } from "@/components/auth/create-staff-form"
import { getSession } from "@/lib/auth-session"
import { Role } from "@/prisma/generated/client/enums"

export default async function CreateStaffPage() {
  const session = await getSession()

  if (!session) {
    redirect("/connexion")
  }

  if (session.user.role !== Role.SUPERADMIN) {
    redirect("/")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <CreateStaffForm />
    </main>
  )
}
