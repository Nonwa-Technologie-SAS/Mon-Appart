import { nestServerFetch } from "@/lib/nest-session"

export type NestAppointmentItem = {
  id: string
  status: string
  scheduledAt: string
  listing?: { id: string; title?: string }
  requester?: { displayName?: string | null }
}

export async function listNestAppointments(): Promise<NestAppointmentItem[]> {
  try {
    const page = await nestServerFetch<{ items: NestAppointmentItem[] }>(
      "/appointments",
      { query: { scope: "upcoming", limit: 50 } },
    )
    return page.items ?? []
  } catch {
    return []
  }
}
