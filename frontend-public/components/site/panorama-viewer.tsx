"use client"

import { useEffect, useRef } from "react"
import { Viewer } from "@photo-sphere-viewer/core"
import "@photo-sphere-viewer/core/index.css"

type PanoramaViewerProps = {
  panoramaUrl: string
}

export function PanoramaViewer({ panoramaUrl }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const viewer = new Viewer({
      container,
      panorama: panoramaUrl,
      navbar: ["zoom", "move", "fullscreen"],
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
    <div ref={containerRef} className="size-full min-h-60 sm:min-h-80" />
  )
}
