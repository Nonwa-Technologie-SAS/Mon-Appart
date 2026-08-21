"use client"

import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost"
}) {
  return (
    <form action={signOut} className="w-full sm:w-auto">
      <Button type="submit" variant={variant} className="w-full sm:w-auto">
        Déconnexion
      </Button>
    </form>
  )
}
