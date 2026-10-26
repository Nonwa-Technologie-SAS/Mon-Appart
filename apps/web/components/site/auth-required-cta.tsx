"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"

/** CTA connexion / inscription pour actions réservées aux comptes clients. */
export function AuthRequiredCta({
  nextPath,
  reason,
}: {
  nextPath: string
  reason: string
}) {
  const next = encodeURIComponent(nextPath)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{reason}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="min-h-11 w-full sm:flex-1"
          nativeButton={false}
          render={<Link href={`/inscription?next=${next}`} />}
        >
          Créer un compte
        </Button>
        <Button
          variant="outline"
          className="min-h-11 w-full sm:flex-1"
          nativeButton={false}
          render={<Link href={`/connexion?next=${next}`} />}
        >
          Se connecter
        </Button>
      </div>
    </div>
  )
}
