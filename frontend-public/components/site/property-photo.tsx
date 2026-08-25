"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

type PropertyPhotoProps = Omit<ImageProps, "onError" | "src"> & {
  src: string | null | undefined
  fallbackClassName?: string
  fallbackLabel?: string
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
  ...props
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
      {...props}
      src={src}
      alt={alt}
      unoptimized={isLocalUpload(src) || props.unoptimized}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
