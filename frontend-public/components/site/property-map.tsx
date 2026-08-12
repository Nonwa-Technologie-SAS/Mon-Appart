"use client"

import { useEffect } from "react"
import Link from "next/link"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import type { PropertyListItem } from "@/lib/properties"
import { formatPrice } from "@/lib/format"

type PropertyMapProps = {
  properties: PropertyListItem[]
  highlightedId: string | null
  onMarkerHover: (id: string | null) => void
}

type MappableProperty = PropertyListItem & {
  latitude: number
  longitude: number
}

const FRANCE_CENTER: [number, number] = [46.603354, 1.888334]

function isMappable(property: PropertyListItem): property is MappableProperty {
  return property.latitude != null && property.longitude != null
}

function priceIcon(price: number, highlighted: boolean) {
  const label = formatPrice(price)
  return L.divIcon({
    className: "property-map-marker",
    html: `<div class="property-map-pin${highlighted ? " is-active" : ""}">${label}</div>`,
    iconSize: [120, 28],
    iconAnchor: [60, 28],
  })
}

function FitBounds({ properties }: { properties: MappableProperty[] }) {
  const map = useMap()
  const boundsKey = properties
    .map((p) => `${p.id}:${p.latitude}:${p.longitude}`)
    .join("|")

  useEffect(() => {
    if (properties.length === 0) {
      map.setView(FRANCE_CENTER, 5)
      return
    }

    if (properties.length === 1) {
      map.setView([properties[0].latitude, properties[0].longitude], 13)
      return
    }

    const bounds = L.latLngBounds(
      properties.map((p) => [p.latitude, p.longitude] as [number, number])
    )
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
    // boundsKey captures property positions; properties is derived from the same source
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, boundsKey])

  return null
}

export function PropertyMap({
  properties,
  highlightedId,
  onMarkerHover,
}: PropertyMapProps) {
  const mappable = properties.filter(isMappable)

  return (
    <MapContainer
      center={FRANCE_CENTER}
      zoom={5}
      className="size-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds properties={mappable} />
      {mappable.map((property) => (
        <Marker
          key={property.id}
          position={[property.latitude, property.longitude]}
          icon={priceIcon(property.price, highlightedId === property.id)}
          eventHandlers={{
            mouseover: () => onMarkerHover(property.id),
            mouseout: () => onMarkerHover(null),
          }}
          zIndexOffset={highlightedId === property.id ? 1000 : 0}
        >
          <Popup>
            <div className="min-w-40 space-y-1">
              <p className="font-medium leading-snug">{property.title}</p>
              <p className="text-sm text-muted-foreground">{property.location}</p>
              <p className="text-sm font-semibold">
                {formatPrice(property.price)}
                <span className="font-normal text-muted-foreground"> / mois</span>
              </p>
              <Link
                href={`/biens/${property.id}`}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Voir le bien
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
