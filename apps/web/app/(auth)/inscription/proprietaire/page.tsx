import { AuthShell } from "@/components/auth/auth-shell"
import { OwnerRegisterForm } from "@/components/auth/owner-register-form"

export default function OwnerRegisterPage() {
  return (
    <AuthShell>
      <OwnerRegisterForm />
    </AuthShell>
  )
}
