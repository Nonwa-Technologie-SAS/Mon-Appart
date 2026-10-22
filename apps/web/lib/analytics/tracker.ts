"use client"

import {
  Tracker,
  createFetchTransport,
  type Tracker as AnalyticsTracker,
} from "@mon-appart/analytics"

import { nestApiBaseUrl, nestApiUrl } from "@/lib/nest-url"

import { ANALYTICS_POLICY_VERSION } from "./consent"

let tracker: AnalyticsTracker | null = null

const storage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
  removeItem(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

/** Tracker singleton ; null si API Nest non configurée. */
export function getWebTracker(): AnalyticsTracker | null {
  if (typeof window === "undefined") return null
  if (tracker) return tracker
  if (nestApiBaseUrl() === null) return null
  tracker = new Tracker({
    source: "web",
    policyVersion: ANALYTICS_POLICY_VERSION,
    transport: createFetchTransport(nestApiUrl("/api/v1/analytics/events"), {
      credentials: "same-origin",
    }),
    storage,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
  })
  return tracker
}

export function trackWebEvent(
  ...args: Parameters<AnalyticsTracker["track"]>
): boolean {
  const instance = getWebTracker()
  if (!instance) return false
  const ok = instance.track(...args)
  void instance.flush()
  return ok
}
