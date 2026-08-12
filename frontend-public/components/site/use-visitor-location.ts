"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "visitorGeo:v1"

let didRequestGeo = false

type StoredGeo = {
  lat: number
  lng: number
  city: string | null
}

type VisitorLocation = {
  status: "idle" | "prompting" | "ready" | "denied" | "unavailable"
  lat: number | null
  lng: number | null
  city: string | null
  requestLocation: () => void
}

function readStoredGeo(): StoredGeo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredGeo
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredGeo(value: StoredGeo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("lat", String(lat))
    url.searchParams.set("lon", String(lng))
    url.searchParams.set("format", "json")
    url.searchParams.set("zoom", "10")

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return null

    const data = (await response.json()) as {
      address?: { city?: string; town?: string; village?: string; municipality?: string }
    }
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      null
    )
  } catch {
    return null
  }
}

export function useVisitorLocation(options: {
  enabled: boolean
  initialLat?: string
  initialLng?: string
}): VisitorLocation {
  const router = useRouter()
  const initialLat = Number(options.initialLat)
  const initialLng = Number(options.initialLng)
  const hasUrlCoords =
    Number.isFinite(initialLat) && Number.isFinite(initialLng)

  const [status, setStatus] = useState<VisitorLocation["status"]>(
    hasUrlCoords ? "ready" : "idle"
  )
  const [lat, setLat] = useState<number | null>(hasUrlCoords ? initialLat : null)
  const [lng, setLng] = useState<number | null>(hasUrlCoords ? initialLng : null)
  const [city, setCity] = useState<string | null>(null)

  const applyCoords = useCallback(
    async (nextLat: number, nextLng: number, replaceUrl: boolean) => {
      setLat(nextLat)
      setLng(nextLng)
      setStatus("ready")

      const resolvedCity = await reverseGeocode(nextLat, nextLng)
      setCity(resolvedCity)
      writeStoredGeo({ lat: nextLat, lng: nextLng, city: resolvedCity })

      if (!replaceUrl || typeof window === "undefined") return

      const params = new URLSearchParams(window.location.search)
      params.set("lat", nextLat.toFixed(5))
      params.set("lng", nextLng.toFixed(5))
      const qs = params.toString()
      router.replace(qs ? `/?${qs}` : "/")
    },
    [router]
  )

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable")
      return
    }

    setStatus("prompting")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void applyCoords(
          position.coords.latitude,
          position.coords.longitude,
          true
        )
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }, [applyCoords])

  useEffect(() => {
    if (!options.enabled) return

    if (hasUrlCoords) {
      const stored = readStoredGeo()
      if (
        stored &&
        Math.abs(stored.lat - initialLat) < 0.01 &&
        Math.abs(stored.lng - initialLng) < 0.01
      ) {
        setCity(stored.city)
        return
      }
      void reverseGeocode(initialLat, initialLng).then(setCity)
      return
    }

    const stored = readStoredGeo()
    if (stored) {
      void applyCoords(stored.lat, stored.lng, true)
      return
    }

    if (didRequestGeo) return
    didRequestGeo = true
    requestLocation()
  }, [
    applyCoords,
    hasUrlCoords,
    initialLat,
    initialLng,
    options.enabled,
    requestLocation,
  ])

  return { status, lat, lng, city, requestLocation }
}
