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

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={loading}
      unoptimized={isLocalUpload(src) || unoptimized}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
