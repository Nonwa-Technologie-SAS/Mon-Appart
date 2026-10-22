/* Mon Appart — service worker (statique, versionné manuellement).
 *
 * Stratégie volontairement restrictive :
 * - précharge page hors ligne + icônes ;
 * - cache-first pour /_next/static et assets publics versionnés ;
 * - network-first pour les navigations document, fallback /offline ;
 * - JAMAIS de cache pour /api, sessions, espace privé, auth, admin.
 *
 * Ne pas y ajouter de logique métier ni de mise en cache de JSON API.
 */
const CACHE_VERSION = "mon-appart-static-v1"
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/logo.png",
  "/manifest.webmanifest",
]

function isPrivatePath(pathname) {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/espace") ||
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/inscription") ||
    pathname.startsWith("/admin")
  )
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.png" ||
    url.pathname.endsWith(".woff2")
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mon-appart-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isPrivatePath(url.pathname)) return

  // Documents : réseau d'abord, page hors ligne en secours.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstDocument(request))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request)
    return response
  } catch {
    const cached = await caches.match("/offline")
    if (cached) return cached
    return new Response(
      "<!doctype html><title>Hors ligne</title><p>Connexion indisponible.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
    )
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || Response.error()
  }
}
