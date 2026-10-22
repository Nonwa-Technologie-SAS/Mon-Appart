"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  ANALYTICS_POLICY_VERSION,
  readStoredConsent,
  writeStoredConsent,
} from "@/lib/analytics/consent"
import { getWebTracker } from "@/lib/analytics/tracker"

/**
 * Bannière de consentement analytique (distincte marketing / CGU).
 * Sans accord : aucun événement client n’est envoyé.
 */
export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getWebTracker()) return
    const stored = readStoredConsent()
    if (stored) {
      void getWebTracker()?.setConsent(stored.granted)
      return
    }
    setVisible(true)
  }, [])

  async function choose(granted: boolean) {
    writeStoredConsent(granted)
    await getWebTracker()?.setConsent(granted)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Mesure d’audience"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-4 shadow-[var(--elevation-lg)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="font-medium">Mesure d’audience (optionnelle)</p>
          <p className="mt-1 text-muted-foreground">
            Aide Mon Appart à comprendre les recherches et contacts, sans
            contenu de messages ni données sensibles. Politique{" "}
            {ANALYTICS_POLICY_VERSION}.{" "}
            <Link
              href="/guides/eviter-les-arnaques"
              className="underline underline-offset-2"
            >
              En savoir plus
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void choose(false)}>
            Refuser
          </Button>
          <Button size="sm" onClick={() => void choose(true)}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  )
}
