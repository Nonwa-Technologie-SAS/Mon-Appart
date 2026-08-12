"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { ViewIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { recordVirtualTourVisit } from "@/app/actions/visits"

const VirtualTourViewer = dynamic(
  () =>
    import("@/components/site/virtual-tour-viewer").then(
      (m) => m.VirtualTourViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-black text-sm text-white/70">
        Chargement de la visite…
      </div>
    ),
  }
)

type VirtualTourButtonProps = {
  propertyId: string
  panoramaUrl: string
  propertyTitle: string
}

export function VirtualTourButton({
  propertyId,
  panoramaUrl,
  propertyTitle,
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

  async function startTour() {
    setOpen(true)
    void recordVirtualTourVisit(propertyId)
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="w-full gap-2"
        onClick={startTour}
      >
        <ViewIcon data-icon="inline-start" />
        Visite virtuelle
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visite virtuelle — ${propertyTitle}`}
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-white/60 uppercase">
                Visite virtuelle
              </p>
              <p className="truncate font-heading text-lg font-semibold">
                {propertyTitle}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setOpen(false)}
            >
              <XIcon data-icon="inline-start" />
              Fermer
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <VirtualTourViewer panoramaUrl={panoramaUrl} />
          </div>
        </div>
      ) : null}
    </>
  )
}
