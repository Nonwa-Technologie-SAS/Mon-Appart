"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, XIcon } from "lucide-react"

import { PropertyPhoto } from "@/components/site/property-photo"
import { cn } from "@/lib/utils"

export type GalleryImage = {
  id: string
  url: string
}

type PropertyImageGalleryProps = {
  images: GalleryImage[]
  title: string
  hasVirtualTour?: boolean
}

export function PropertyImageGallery({
  images,
  title,
  hasVirtualTour = false,
}: PropertyImageGalleryProps) {
  const [index, setIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const count = images.length
  const lastIndex = count - 1
  const current = images[index]
  const showNav = count > 1

  function goPrev() {
    setIndex((i) => (i === 0 ? lastIndex : i - 1))
  }

  function goNext() {
    setIndex((i) => (i === lastIndex ? 0 : i + 1))
  }

  useEffect(() => {
    if (!lightboxOpen) {
      return
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxOpen(false)
        return
      }
      if (event.key === "ArrowLeft") {
        setIndex((i) => (i === 0 ? lastIndex : i - 1))
      }
      if (event.key === "ArrowRight") {
        setIndex((i) => (i === lastIndex ? 0 : i + 1))
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [lightboxOpen, lastIndex])

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <div className="relative aspect-16/10 overflow-hidden rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-16/10 overflow-hidden rounded-xl bg-muted">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 cursor-zoom-in"
          aria-label="Agrandir la photo"
        >
          <PropertyPhoto
            src={current.url}
            alt={`${title} — photo ${index + 1} sur ${count}`}
            fill
            preload
            loading="eager"
            sizes="(max-width: 1024px) 100vw, 60vw"
            quality={85}
            className="object-cover"
          />
        </button>

        {showNav ? (
          <>
            <GalleryControl
              className="absolute top-1/2 left-3 z-10 -translate-y-1/2"
              label="Photo précédente"
              onClick={goPrev}
            >
              <ChevronLeftIcon />
            </GalleryControl>
            <GalleryControl
              className="absolute top-1/2 right-3 z-10 -translate-y-1/2"
              label="Photo suivante"
              onClick={goNext}
            >
              <ChevronRightIcon />
            </GalleryControl>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
          {hasVirtualTour ? (
            <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
              Visite en ligne
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {index + 1} / {count}
          </span>
        </div>

        <GalleryControl
          className="absolute right-3 bottom-3 z-10"
          label="Afficher en grand"
          onClick={() => setLightboxOpen(true)}
        >
          <ExpandIcon />
        </GalleryControl>
      </div>

      {showNav ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {images.map((image, imageIndex) => {
            const selected = imageIndex === index

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-label={`Afficher la photo ${imageIndex + 1}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative aspect-4/3 w-[calc((100%-1rem)/3)] shrink-0 overflow-hidden rounded-lg bg-muted transition-opacity",
                  selected
                    ? "ring-2 ring-primary ring-offset-2"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                <PropertyPhoto
                  src={image.url}
                  alt=""
                  fill
                  sizes="220px"
                  quality={75}
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      ) : null}

      {lightboxOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie photos — ${title}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm font-medium">
              {index + 1} / {count}
            </p>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fermer la galerie"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <PropertyPhoto
              src={current.url}
              alt={`${title} — photo ${index + 1} sur ${count}`}
              fill
              sizes="100vw"
              quality={85}
              className="object-contain"
            />

            {showNav ? (
              <>
                <GalleryControl
                  className="absolute top-1/2 left-3 -translate-y-1/2 sm:left-6"
                  label="Photo précédente"
                  onClick={goPrev}
                >
                  <ChevronLeftIcon />
                </GalleryControl>
                <GalleryControl
                  className="absolute top-1/2 right-3 -translate-y-1/2 sm:right-6"
                  label="Photo suivante"
                  onClick={goNext}
                >
                  <ChevronRightIcon />
                </GalleryControl>
              </>
            ) : null}
          </div>

          {showNav ? (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
              {images.map((image, imageIndex) => {
                const selected = imageIndex === index

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setIndex(imageIndex)}
                    aria-label={`Afficher la photo ${imageIndex + 1}`}
                    className={cn(
                      "relative size-14 shrink-0 overflow-hidden rounded-md sm:size-16",
                      selected
                        ? "ring-2 ring-white"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <PropertyPhoto
                      src={image.url}
                      alt=""
                      fill
                      sizes="64px"
                      quality={75}
                      className="object-cover"
                    />
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function GalleryControl({
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
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/75",
        className
      )}
    >
      {children}
    </button>
  )
}
