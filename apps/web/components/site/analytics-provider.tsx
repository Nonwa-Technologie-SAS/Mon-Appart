"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { captureAcquisitionTouches } from "@/lib/analytics/acquisition-session"
import { readStoredConsent } from "@/lib/analytics/consent"
import { normalizeAnalyticsRoute } from "@/lib/analytics/routes"
import { getWebTracker, trackWebEvent } from "@/lib/analytics/tracker"

import { AnalyticsConsentBanner } from "./analytics-consent-banner"

const TOUCH_SENT = "mon-appart:growth:touch-sent:v1"

/**
 * Branche le client `@mon-appart/analytics` : pages, acquisition, flush.
 * Ne bloque jamais la navigation.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const opened = useRef(false)

  useEffect(() => {
    const tracker = getWebTracker()
    if (!tracker) return
    const stored = readStoredConsent()
    if (stored) void tracker.setConsent(stored.granted)
  }, [])

  useEffect(() => {
    const tracker = getWebTracker()
    if (!tracker || !tracker.hasConsent) return

    if (!opened.current) {
      opened.current = true
      trackWebEvent("app_opened", {})
    }

    const route = normalizeAnalyticsRoute(pathname || "/")
    trackWebEvent("page_viewed", { route })

    try {
      if (!sessionStorage.getItem(TOUCH_SENT)) {
        const { first, session } = captureAcquisitionTouches(pathname || "/")
        if (first) trackWebEvent("acquisition_touch", first)
        else if (session) trackWebEvent("acquisition_touch", session)
        sessionStorage.setItem(TOUCH_SENT, "1")
      }
    } catch {
      // sessionStorage indisponible
    }
  }, [pathname])

  return (
    <>
      {children}
      <AnalyticsConsentBanner />
    </>
  )
}
