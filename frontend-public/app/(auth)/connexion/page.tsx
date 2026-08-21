import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignInForm } from "@/components/auth/sign-in-form"
import {
  getSession,
  isPublisherRole,
  safeInternalPath,
} from "@/lib/auth-session"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; next?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  const nextPath = safeInternalPath(params.next)

  if (session && isPublisherRole(session.user.role)) {
    redirect(nextPath ?? "/espace")
  }
  if (session) {
    redirect(nextPath ?? "/")
  }

  return (
    <AuthShell>
      <SignInForm
        registered={params.registered === "1"}
        next={nextPath}
      />
    </AuthShell>
  )
}
