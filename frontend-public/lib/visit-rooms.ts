export const VISIT_ROOMS = [
  "ENTRANCE",
  "LIVING",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "EXTERIOR",
  "OTHER",
] as const

export type VisitRoom = (typeof VISIT_ROOMS)[number]

export const VISIT_ROOM_LABELS: Record<VisitRoom, string> = {
  ENTRANCE: "Entrée",
  LIVING: "Salon",
  KITCHEN: "Cuisine",
  BEDROOM: "Chambre",
  BATHROOM: "Salle de bain",
  EXTERIOR: "Extérieur",
  OTHER: "Autre",
}

export const VISIT_ROOM_OPTIONS = VISIT_ROOMS.map((value) => ({
  value,
  label: VISIT_ROOM_LABELS[value],
}))

export type VisitLayoutItem = {
  url: string
  room: VisitRoom
  sortOrder: number
}

export type VisitPhotoInput = {
  id: string
  url: string
  room?: string | null
  sortOrder?: number | null
}

export function isVisitRoom(value: unknown): value is VisitRoom {
  return typeof value === "string" && VISIT_ROOMS.includes(value as VisitRoom)
}

export function groupPhotosByRoom<T extends VisitPhotoInput>(photos: T[]) {
  const grouped = new Map<VisitRoom, T[]>()
  for (const room of VISIT_ROOMS) {
    grouped.set(room, [])
  }

  const ordered = photos.toSorted(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  )

  for (const photo of ordered) {
    const room = isVisitRoom(photo.room) ? photo.room : "OTHER"
    grouped.get(room)!.push(photo)
  }

  return VISIT_ROOMS.flatMap((room) => {
    const roomPhotos = grouped.get(room) ?? []
    if (roomPhotos.length === 0) return []
    return [
      {
        id: room,
        label: VISIT_ROOM_LABELS[room],
        photos: roomPhotos,
      },
    ]
  })
}
