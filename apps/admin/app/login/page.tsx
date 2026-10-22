import type { Metadata } from "next"

import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = { title: "Connexion — Mon Appart Admin" }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </main>
  )
}
