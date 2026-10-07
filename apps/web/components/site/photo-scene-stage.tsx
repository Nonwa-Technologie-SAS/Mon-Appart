"use client"

import { useEffect, useRef, type Ref } from "react"

import { cn } from "@/lib/utils"

const MIN_SCALE = 1.08
const MAX_SCALE = 2.45
const DEFAULT_SCALE = 1.22

export type PhotoSceneHandle = {
  zoomBy: (direction: 1 | -1) => void
}

type PhotoSceneStageProps = {
  url: string
  alt: string
  className?: string
  ref?: Ref<PhotoSceneHandle>
  onLoadDimensions?: (size: { width: number; height: number }) => void
}

type ViewState = {
  x: number
  y: number
  scale: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pinchDistance(a: PointerEvent, b: PointerEvent) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function PhotoSceneStage({
  url,
  alt,
  className,
  ref,
  onLoadDimensions,
}: PhotoSceneStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const viewRef = useRef<ViewState>({ x: 0, y: 0, scale: DEFAULT_SCALE })
  const pointersRef = useRef(new Map<number, PointerEvent>())
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    pinchStart: 0,
    pinchScale: DEFAULT_SCALE,
  })
  const handleRef = useRef<PhotoSceneHandle>({
    zoomBy: () => undefined,
  })

  function applyView() {
    const image = imageRef.current
    const viewport = viewportRef.current
    if (!image || !viewport) return

    const view = viewRef.current
    const width = viewport.clientWidth
    const height = viewport.clientHeight
    const maxX = ((view.scale - 1) / 2) * width
    const maxY = ((view.scale - 1) / 2) * height
    view.x = clamp(view.x, -maxX, maxX)
    view.y = clamp(view.y, -maxY, maxY)
    image.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
  }

  function zoomBy(direction: 1 | -1) {
    viewRef.current.scale = clamp(
      viewRef.current.scale * (direction > 0 ? 1.12 : 1 / 1.12),
      MIN_SCALE,
      MAX_SCALE
    )
    applyView()
  }

  handleRef.current.zoomBy = zoomBy

  useEffect(() => {
    if (!ref) return
    if (typeof ref === "function") {
      ref(handleRef.current)
      return () => ref(null)
    }
    ref.current = handleRef.current
    return () => {
      ref.current = null
    }
  }, [ref])

  useEffect(() => {
    viewRef.current = { x: 0, y: 0, scale: DEFAULT_SCALE }
    applyView()
  }, [url])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function onPointerDown(event: PointerEvent) {
      viewport.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, event)
      dragRef.current.active = true
      dragRef.current.lastX = event.clientX
      dragRef.current.lastY = event.clientY

      if (pointersRef.current.size === 2) {
        const [first, second] = [...pointersRef.current.values()]
        if (first && second) {
          dragRef.current.pinchStart = pinchDistance(first, second)
          dragRef.current.pinchScale = viewRef.current.scale
        }
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointersRef.current.has(event.pointerId)) return
      pointersRef.current.set(event.pointerId, event)

      if (pointersRef.current.size === 2) {
        const [first, second] = [...pointersRef.current.values()]
        if (!first || !second || dragRef.current.pinchStart <= 0) return
        event.preventDefault()
        const ratio = pinchDistance(first, second) / dragRef.current.pinchStart
        viewRef.current.scale = clamp(
          dragRef.current.pinchScale * ratio,
          MIN_SCALE,
          MAX_SCALE
        )
        applyView()
        return
      }

      if (!dragRef.current.active) return
      event.preventDefault()
      const dx = event.clientX - dragRef.current.lastX
      const dy = event.clientY - dragRef.current.lastY
      dragRef.current.lastX = event.clientX
      dragRef.current.lastY = event.clientY
      viewRef.current.x += dx
      viewRef.current.y += dy
      applyView()
    }

    function onPointerUp(event: PointerEvent) {
      pointersRef.current.delete(event.pointerId)
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId)
      }
      if (pointersRef.current.size === 0) {
        dragRef.current.active = false
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      viewRef.current.scale = clamp(
        viewRef.current.scale * (event.deltaY < 0 ? 1.08 : 1 / 1.08),
        MIN_SCALE,
        MAX_SCALE
      )
      applyView()
    }

    viewport.addEventListener("pointerdown", onPointerDown)
    viewport.addEventListener("pointermove", onPointerMove)
    viewport.addEventListener("pointerup", onPointerUp)
    viewport.addEventListener("pointercancel", onPointerUp)
    viewport.addEventListener("wheel", onWheel, { passive: false })

    const observer = new ResizeObserver(() => applyView())
    observer.observe(viewport)

    return () => {
      observer.disconnect()
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", onPointerUp)
      viewport.removeEventListener("pointercancel", onPointerUp)
      viewport.removeEventListener("wheel", onWheel)
    }
  }, [])

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative size-full cursor-grab overflow-hidden touch-none active:cursor-grabbing",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={url}
        alt={alt}
        draggable={false}
        className="size-full origin-center object-cover will-change-transform select-none"
        style={{ transform: `scale(${DEFAULT_SCALE})` }}
        onLoad={(event) => {
          onLoadDimensions?.({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
          applyView()
        }}
      />
    </div>
  )
}
