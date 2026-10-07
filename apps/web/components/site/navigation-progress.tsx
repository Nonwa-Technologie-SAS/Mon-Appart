"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false
  if (anchor.hasAttribute("download")) return false

  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false
  }

  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) return false

  return (
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search
  )
}

function NavigationProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlKey = `${pathname}?${searchParams.toString()}`
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle")
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest("a")
      if (!anchor || !isInternalNavigation(anchor)) return

      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      setPhase("loading")
    }

    function onPopState() {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      setPhase("loading")
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  useEffect(() => {
    setPhase((current) => {
      if (current === "idle") return "idle"
      return "done"
    })
    hideTimer.current = window.setTimeout(() => setPhase("idle"), 280)
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [urlKey])

  if (phase === "idle") return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      role="progressbar"
      aria-hidden
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={phase === "done" ? 100 : 70}
    >
      <div
        className={cn(
          "h-full origin-left bg-primary shadow-[0_0_10px] shadow-primary/50",
          phase === "loading" ? "nav-progress-loading" : "nav-progress-done"
        )}
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  )
}
