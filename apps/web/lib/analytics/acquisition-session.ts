"use client"

import {
  buildAcquisitionTouch,
  hasAttributionSignal,
  type AcquisitionTouch,
} from "@mon-appart/analytics"

import { normalizeAnalyticsRoute } from "./routes"

const FIRST_KEY = "mon-appart:growth:first-touch:v1"
const SESSION_KEY = "mon-appart:growth:session-touch:v1"

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function readLocalJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeLocalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/**
 * Capture UTM + referrer une fois par session (et first-touch local).
 * Ne remplace pas un outil publicitaire connecté.
 */
export function captureAcquisitionTouches(pathname: string): {
  first: AcquisitionTouch | null
  session: AcquisitionTouch | null
} {
  if (typeof window === "undefined") {
    return { first: null, session: null }
  }

  const landingRoute = normalizeAnalyticsRoute(pathname)
  const touch = buildAcquisitionTouch({
    searchParams: new URLSearchParams(window.location.search),
    referrer: document.referrer || null,
    landingRoute,
    touchKind: "SESSION",
  })

  let session: AcquisitionTouch | null = readJson<AcquisitionTouch>(SESSION_KEY)
  if (!session && (hasAttributionSignal(touch) || touch.channel === "DIRECT")) {
    session = { ...touch, touchKind: "SESSION" }
    writeJson(SESSION_KEY, session)
  }

  let first = readLocalJson<AcquisitionTouch>(FIRST_KEY)
  if (!first && hasAttributionSignal(touch)) {
    first = { ...touch, touchKind: "FIRST" }
    writeLocalJson(FIRST_KEY, first)
  }

  return { first, session }
}
