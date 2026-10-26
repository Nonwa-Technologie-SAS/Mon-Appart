import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { CustomerRegisterForm } from "@/components/auth/customer-register-form"
import {
  getSession,
  isPublisherRole,
  safeInternalPath,
} from "@/lib/auth-session"

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const nextPath = safeInternalPath(params.next)
  const session = await getSession()

  if (session && isPublisherRole(session.user.role)) {
    redirect(nextPath ?? "/espace")
  }
  if (session) {
    redirect(nextPath ?? "/profil")
  }

  return (
    <AuthShell>
      <CustomerRegisterForm next={nextPath} />
    </AuthShell>
  )
}
