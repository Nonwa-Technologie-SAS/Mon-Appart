"use client"

import { useEffect, useState } from "react"

/**
 * Bandeau discret hors ligne — ne simule pas de données.
 */
export function NetworkStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-warning/30 bg-warning/15 px-4 py-2 text-center text-sm text-foreground"
    >
      Connexion indisponible — les actions (visite, compte, publication) ne
      pourront pas être confirmées tant que le réseau n’est pas rétabli.
    </div>
  )
}
