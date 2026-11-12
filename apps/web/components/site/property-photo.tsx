"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

type PropertyPhotoProps = {
  src: string | null | undefined
  alt: string
  className?: string
  fallbackClassName?: string
  fallbackLabel?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  quality?: number
  priority?: boolean
  loading?: "eager" | "lazy"
  unoptimized?: boolean
}

function isLocalUpload(src: string) {
  return src.startsWith("/uploads/")
}

/** Nest renvoie souvent une URL absolue ; le rewrite Next sert déjà `/api/v1/*`. */
function toSiteImageSrc(src: string): string {
  try {
    if (src.startsWith("/")) return src
    const url = new URL(src)
    if (url.pathname.startsWith("/api/v1/media/")) {
      return `${url.pathname}${url.search}`
    }
  } catch {
    // URL relative ou invalide : on laisse next/image gérer.
  }
  return src
}

export function PropertyPhoto({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = "Photo à venir",
  fill,
  width,
  height,
  sizes,
  quality,
  priority,
  loading,
  unoptimized,
}: PropertyPhotoProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-muted text-sm text-muted-foreground",
          fallbackClassName
        )}
      >
        {fallbackLabel}
      </div>
    )
  }

  const imageSrc = toSiteImageSrc(src)

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={loading}
      unoptimized={isLocalUpload(imageSrc) || unoptimized}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
