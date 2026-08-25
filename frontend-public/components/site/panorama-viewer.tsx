"use client"

import { Viewer } from "@photo-sphere-viewer/core"
import { useEffect, useRef } from "react"
import "@photo-sphere-viewer/core/index.css"

import { cn } from "@/lib/utils"

type PanoramaViewerProps = {
  panoramaUrl: string
  className?: string
}

export function PanoramaViewer({ panoramaUrl, className }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const viewer = new Viewer({
      container,
      panorama: panoramaUrl,
      navbar: ["zoom", "move"],
      defaultZoomLvl: 50,
      mousewheel: true,
      touchmoveTwoFingers: true,
      loadingTxt: "Chargement de la visite 360°…",
    })

    return () => {
      viewer.destroy()
    }
  }, [panoramaUrl])

  return (
    <div
      ref={containerRef}
      className={cn("size-full min-h-60 sm:min-h-80", className)}
    />
  )
}
