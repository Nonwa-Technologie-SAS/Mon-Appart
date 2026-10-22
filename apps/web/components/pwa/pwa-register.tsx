"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

const DISMISS_KEY = "mon-appart:pwa-install-dismissed:v1"
const UPDATE_FLAG = "mon-appart:pwa-update-pending"

/**
 * Enregistre le SW en production uniquement.
 * Propose l’installation sans bloquer la première visite ;
 * propose un rechargement si une nouvelle version attend.
 */
export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  )
  const [showInstall, setShowInstall] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const waitingWorker = useRef<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    let cancelled = false

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return

        if (registration.waiting) {
          waitingWorker.current = registration.waiting
          setUpdateReady(true)
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              waitingWorker.current = worker
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(() => {
        // Enregistrement échoué : l’app reste utilisable en ligne.
      })

    const onControllerChange = () => {
      if (sessionStorage.getItem(UPDATE_FLAG) === "1") {
        sessionStorage.removeItem(UPDATE_FLAG)
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    )

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return
      } catch {
        // private mode
      }
      if (window.matchMedia("(display-mode: standalone)").matches) return
      setInstallEvent(promptEvent)
      setShowInstall(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      )
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
    }
  }, [])

  async function acceptInstall() {
    if (!installEvent) return
    setShowInstall(false)
    await installEvent.prompt()
    setInstallEvent(null)
  }

  function dismissInstall() {
    setShowInstall(false)
    setInstallEvent(null)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // ignore
    }
  }

  function applyUpdate() {
    const worker = waitingWorker.current
    if (!worker) {
      window.location.reload()
      return
    }
    sessionStorage.setItem(UPDATE_FLAG, "1")
    worker.postMessage({ type: "SKIP_WAITING" })
  }

  return (
    <>
      {showInstall && installEvent ? (
        <div
          role="dialog"
          aria-label="Installer Mon Appart"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-[var(--elevation-lg)] sm:inset-x-auto sm:right-4 sm:bottom-4"
        >
          <p className="text-sm font-semibold text-foreground">
            Installer Mon Appart
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un raccourci sur l’écran d’accueil pour rouvrir la recherche
            plus vite. Aucune obligation — vous pouvez continuer dans le
            navigateur.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" className="min-h-11 flex-1" onClick={acceptInstall}>
              Installer
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={dismissInstall}
            >
              Plus tard
            </Button>
          </div>
        </div>
      ) : null}

      {updateReady ? (
        <div
          role="status"
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--elevation-md)] sm:inset-x-auto sm:right-4 sm:top-20"
        >
          <p className="flex-1 text-sm text-foreground">
            Une nouvelle version est prête. Rechargez quand vous avez terminé
            votre saisie.
          </p>
          <Button type="button" size="sm" className="min-h-11 shrink-0" onClick={applyUpdate}>
            Recharger
          </Button>
        </div>
      ) : null}
    </>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
