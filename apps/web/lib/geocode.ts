export class GeocodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeocodeError"
  }
}

type GeoCoords = {
  lat: number
  lng: number
}

const geocodeCache = new Map<string, GeoCoords>()

function withIvoryCoast(query: string) {
  if (/côte d['’]?ivoire|cote d['’]?ivoire|ivory coast/i.test(query)) {
    return query
  }
  return `${query}, Côte d'Ivoire`
}

function parseNominatimResult(data: unknown): GeoCoords | null {
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0] as { lat?: string; lon?: string }
  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng }
}

export function hasCoordinates(
  latitude?: number | null,
  longitude?: number | null
) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

export async function geocodeLocation(location: string): Promise<GeoCoords> {
  const query = location.trim()
  if (query.length < 2) {
    throw new GeocodeError("La localisation est requise")
  }

  const cacheKey = query.toLowerCase()
  const cached = geocodeCache.get(cacheKey)
  if (cached) return cached

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", withIvoryCoast(query))
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "ci")

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "MonAppart/1.0 (listing geocoding)",
      },
    })
  } catch {
    throw new GeocodeError(
      "Impossible de localiser cette adresse pour le moment"
    )
  }

  if (!response.ok) {
    throw new GeocodeError(
      "Impossible de localiser cette adresse pour le moment"
    )
  }

  const coords = parseNominatimResult(await response.json().catch(() => null))
  if (!coords) {
    throw new GeocodeError(
      "Localité introuvable. Précisez la ville ou le quartier (ex. Cocody, Abidjan)."
    )
  }

  geocodeCache.set(cacheKey, coords)
  return coords
}
