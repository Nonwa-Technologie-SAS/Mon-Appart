import { AuthShell } from "@/components/auth/auth-shell"
import { AgencyRegisterForm } from "@/components/auth/agency-register-form"

export default function AgencyRegisterPage() {
  return (
    <AuthShell>
      <AgencyRegisterForm />
    </AuthShell>
  )
}
