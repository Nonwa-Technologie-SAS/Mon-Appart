"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { ViewIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { recordVirtualTourVisit } from "@/app/actions/visits"
import type { VisitPhoto } from "@/components/site/virtual-tour-viewer"

const VirtualTourViewer = dynamic(
  () =>
    import("@/components/site/virtual-tour-viewer").then(
      (m) => m.VirtualTourViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full flex-col items-center justify-center bg-[#07070c] text-white">
        <p className="text-xs tracking-[0.2em] uppercase text-white/70">
          Mon Appart
        </p>
        <p className="mt-3 text-xl font-semibold">Ouverture de la visite…</p>
      </div>
    ),
  }
)

type VirtualTourButtonProps = {
  propertyId: string
  propertyTitle: string
  photos: VisitPhoto[]
  panoramaUrl?: string | null
}

export function VirtualTourButton({
  propertyId,
  propertyTitle,
  photos,
  panoramaUrl,
}: VirtualTourButtonProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function startTour() {
    setOpen(true)
    void recordVirtualTourVisit(propertyId)
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full gap-2"
        onClick={startTour}
      >
        <ViewIcon data-icon="inline-start" />
        Visite en ligne
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visite en ligne — ${propertyTitle}`}
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:px-6">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-white/60 uppercase">
                Visite en ligne
              </p>
              <p className="truncate font-heading text-lg font-semibold">
                {propertyTitle}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => setOpen(false)}
            >
              <XIcon data-icon="inline-start" />
              Fermer
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <VirtualTourViewer photos={photos} panoramaUrl={panoramaUrl} />
          </div>
        </div>
      ) : null}
    </>
  )
}
