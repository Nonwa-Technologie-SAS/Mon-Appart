"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  Undo2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  PhotoSceneStage,
  type PhotoSceneHandle,
} from "@/components/site/photo-scene-stage"
import {
  buildTourGraph,
  isLikelyEquirectangular,
  type TourScene,
} from "@/lib/tour-graph"
import type { VisitPhotoInput } from "@/lib/visit-rooms"
import { cn } from "@/lib/utils"

export type VisitPhoto = VisitPhotoInput

const PanoramaViewer = dynamic(
  () =>
    import("@/components/site/panorama-viewer").then((m) => m.PanoramaViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center text-sm text-white/70">
        Chargement de la vue 360°…
      </div>
    ),
  }
)

type VirtualTourViewerProps = {
  photos: VisitPhoto[]
  panoramaUrl?: string | null
}

export function VirtualTourViewer({
  photos,
  panoramaUrl,
}: VirtualTourViewerProps) {
  const graph = useMemo(
    () => buildTourGraph(photos, panoramaUrl),
    [photos, panoramaUrl]
  )
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const [visible, setVisible] = useState(true)
  const [equirectIds, setEquirectIds] = useState<Record<string, true>>({})
  const pendingIndexRef = useRef<number | null>(null)
  const skipHistoryRef = useRef(false)
  const photoStageRef = useRef<PhotoSceneHandle>(null)
  const navigateRef = useRef<(nextIndex: number, recordHistory?: boolean) => void>(
    () => undefined
  )

  const sceneCount = graph.scenes.length
  const safeIndex = Math.min(index, Math.max(sceneCount - 1, 0))
  const scene = graph.scenes[safeIndex] ?? null
  const hotspots = graph.hotspotsByScene[safeIndex] ?? []
  const prevHotspot = hotspots.find((item) => item.side === "prev")
  const nextHotspot = hotspots.find((item) => item.side === "next")
  const canGoBack = history.length > 0

  function navigate(nextIndex: number, recordHistory = true) {
    if (!sceneCount) return
    const clamped = Math.min(Math.max(nextIndex, 0), sceneCount - 1)
    if (clamped === safeIndex && pendingIndexRef.current == null) return
    skipHistoryRef.current = !recordHistory
    pendingIndexRef.current = clamped
    setVisible(false)
  }

  navigateRef.current = navigate

  useEffect(() => {
    if (visible) return

    const timer = window.setTimeout(() => {
      const nextIndex = pendingIndexRef.current
      if (nextIndex != null) {
        if (!skipHistoryRef.current) {
          setHistory((current) => [...current, safeIndex])
        }
        setIndex(nextIndex)
        pendingIndexRef.current = null
        skipHistoryRef.current = false
      }
      setVisible(true)
    }, 180)

    return () => window.clearTimeout(timer)
  }, [visible, safeIndex])

  useEffect(() => {
    const previousUrl = graph.scenes[safeIndex - 1]?.url
    const nextUrl = graph.scenes[safeIndex + 1]?.url
    for (const url of [previousUrl, nextUrl]) {
      if (!url) continue
      const image = new window.Image()
      image.src = url
    }
  }, [graph.scenes, safeIndex])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && prevHotspot) {
        navigateRef.current(prevHotspot.targetIndex)
      }
      if (event.key === "ArrowRight" && nextHotspot) {
        navigateRef.current(nextHotspot.targetIndex)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nextHotspot?.targetIndex, prevHotspot?.targetIndex])

  if (!scene) {
    return (
      <div className="flex size-full items-center justify-center bg-black px-6 text-center text-sm text-white/70">
        Aucune photo n’est disponible pour cette visite.
      </div>
    )
  }

  const kind: TourScene["kind"] =
    scene.kind === "panorama" || equirectIds[scene.id]
      ? "panorama"
      : "photo"

  return (
    <div className="relative size-full min-h-0 bg-black">
      <div
        className={cn(
          "size-full transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
      >
        {kind === "panorama" ? (
          <PanoramaViewer panoramaUrl={scene.url} className="min-h-0" />
        ) : (
          <PhotoSceneStage
            key={scene.id}
            ref={photoStageRef}
            url={scene.url}
            alt={scene.pointLabel}
            onLoadDimensions={({ width, height }) => {
              if (isLikelyEquirectangular(width, height)) {
                setEquirectIds((current) =>
                  current[scene.id] ? current : { ...current, [scene.id]: true }
                )
              }
            }}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
        <p className="rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {scene.pointLabel}
        </p>
      </div>

      {prevHotspot ? (
        <HotspotButton
          className="absolute top-1/2 left-3 z-10 -translate-y-1/2 sm:left-5"
          label={prevHotspot.label}
          onClick={() => navigate(prevHotspot.targetIndex)}
        >
          <ChevronLeftIcon />
        </HotspotButton>
      ) : null}

      {nextHotspot ? (
        <HotspotButton
          className="absolute top-1/2 right-3 z-10 -translate-y-1/2 sm:right-5"
          label={nextHotspot.label}
          onClick={() => navigate(nextHotspot.targetIndex)}
        >
          <ChevronRightIcon />
        </HotspotButton>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 bg-linear-to-t from-black/80 to-transparent px-3 pt-16 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {canGoBack ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const previous = history.at(-1)
                if (previous == null) return
                setHistory((current) => current.slice(0, -1))
                navigate(previous, false)
              }}
            >
              <Undo2Icon data-icon="inline-start" />
              Retour
            </Button>
          ) : null}

          {kind === "photo" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Réduire"
                onClick={() => photoStageRef.current?.zoomBy(-1)}
              >
                <MinusIcon />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Agrandir"
                onClick={() => photoStageRef.current?.zoomBy(1)}
              >
                <PlusIcon />
              </Button>
            </>
          ) : null}
        </div>

        {graph.roomStarts.length > 1 ? (
          <div className="pointer-events-auto flex w-full max-w-3xl gap-2 overflow-x-auto pb-1">
            {graph.roomStarts.map((room) => {
              const selected = scene.roomId === room.roomId

              return (
                <button
                  key={`${room.roomId}-${room.index}`}
                  type="button"
                  onClick={() => navigate(room.index)}
                  className={cn(
                    "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border",
                    selected
                      ? "border-primary ring-2 ring-primary"
                      : "border-white/20 opacity-80 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={room.coverUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                    {room.roomLabel}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        <p className="text-[11px] text-white/55">
          {kind === "panorama"
            ? "Glissez pour regarder à 360°"
            : "Glissez pour regarder autour · pincez pour zoomer"}
        </p>
      </div>
    </div>
  )
}

function HotspotButton({
  className,
  label,
  onClick,
  children,
}: {
  className?: string
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "pointer-events-auto flex min-h-11 min-w-11 flex-col items-center gap-1",
        className
      )}
    >
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm hover:bg-black/75 [&_svg]:size-5">
        {children}
      </span>
      <span className="max-w-24 truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white sm:max-w-32">
        {label}
      </span>
    </button>
  )
}
