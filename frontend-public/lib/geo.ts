const EARTH_RADIUS_KM = 6371

export type GeoPoint = {
  lat: number
  lng: number
}

export function parseCoordinate(value?: string) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function haversineKm(from: GeoPoint, to: GeoPoint) {
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000))} m`
  }
  return `${distanceKm < 10 ? distanceKm.toFixed(1).replace(".", ",") : Math.round(distanceKm)} km`
}

export const NEARBY_RADIUS_KM = 35
export const AROUND_RADIUS_KM = 150

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180
}
