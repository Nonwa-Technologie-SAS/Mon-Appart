import {
  groupPhotosByRoom,
  type VisitPhotoInput,
  type VisitRoom,
} from "@/lib/visit-rooms"

export type TourSceneKind = "photo" | "panorama"

export type TourScene = {
  id: string
  url: string
  kind: TourSceneKind
  roomId: VisitRoom | "PANORAMA"
  roomLabel: string
  pointLabel: string
}

export type TourHotspot = {
  targetIndex: number
  label: string
  side: "prev" | "next"
}

export type TourRoomStart = {
  roomId: TourScene["roomId"]
  roomLabel: string
  index: number
  coverUrl: string
}

export type TourGraph = {
  scenes: TourScene[]
  hotspotsByScene: TourHotspot[][]
  roomStarts: TourRoomStart[]
}

const EQUIRECT_MIN = 1.9
const EQUIRECT_MAX = 2.15

export function isLikelyEquirectangular(width: number, height: number) {
  if (width <= 0 || height <= 0) return false
  const ratio = width / height
  return ratio >= EQUIRECT_MIN && ratio <= EQUIRECT_MAX
}

export function buildTourGraph(
  photos: VisitPhotoInput[],
  panoramaUrl?: string | null
): TourGraph {
  const rooms = groupPhotosByRoom(photos)
  const scenes: TourScene[] = []

  for (const room of rooms) {
    const total = room.photos.length
    room.photos.forEach((photo, index) => {
      scenes.push({
        id: photo.id,
        url: photo.url,
        kind: "photo",
        roomId: room.id,
        roomLabel: room.label,
        pointLabel:
          total > 1 ? `${room.label} · ${index + 1}/${total}` : room.label,
      })
    })
  }

  const panorama = panoramaUrl?.trim()
  if (panorama) {
    const existing = scenes.find((scene) => scene.url === panorama)
    if (existing) {
      existing.kind = "panorama"
      existing.roomLabel = "Vue 360°"
      existing.pointLabel = "Vue 360°"
      existing.roomId = "PANORAMA"
    } else {
      scenes.push({
        id: "virtual-tour-panorama",
        url: panorama,
        kind: "panorama",
        roomId: "PANORAMA",
        roomLabel: "Vue 360°",
        pointLabel: "Vue 360°",
      })
    }
  }

  const hotspotsByScene = scenes.map((scene, index) => {
    const hotspots: TourHotspot[] = []
    const prev = scenes[index - 1]
    const next = scenes[index + 1]

    if (prev) {
      hotspots.push({
        targetIndex: index - 1,
        side: "prev",
        label:
          prev.roomId === scene.roomId
            ? "Point de vue précédent"
            : prev.roomLabel,
      })
    }

    if (next) {
      hotspots.push({
        targetIndex: index + 1,
        side: "next",
        label:
          next.roomId === scene.roomId
            ? "Point de vue suivant"
            : next.roomLabel,
      })
    }

    return hotspots
  })

  const roomStarts: TourRoomStart[] = []
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index]
    const previous = scenes[index - 1]
    if (!scene) continue
    if (previous && previous.roomId === scene.roomId) continue
    roomStarts.push({
      roomId: scene.roomId,
      roomLabel: scene.roomLabel,
      index,
      coverUrl: scene.url,
    })
  }

  return { scenes, hotspotsByScene, roomStarts }
}
