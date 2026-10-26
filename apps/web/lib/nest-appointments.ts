import { nestServerFetch } from "@/lib/nest-session"

export type NestAppointmentItem = {
  id: string
  status: string
  side: "REQUESTER" | "LISTING_SIDE" | string
  scheduledAt: string
  timezone?: string
  notes?: string | null
  proposedAt?: string | null
  listing?: { id: string; title?: string }
  requester?: { displayName?: string | null }
  actions: string[]
  conversationId?: string | null
  completedAt?: string | null
  feedback?: { submitted: boolean; outcome: string | null }
}

export async function listNestAppointments(
  scope: "upcoming" | "past" | "all" = "all",
): Promise<NestAppointmentItem[]> {
  try {
    const page = await nestServerFetch<{ items: NestAppointmentItem[] }>(
      "/appointments",
      { query: { scope, limit: 50 } },
    )
    return page.items ?? []
  } catch {
    return []
  }
}
