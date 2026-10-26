import { nestServerFetch } from "@/lib/nest-session"

export type NestPreferenceCell = {
  category: string
  channel: string
  enabled: boolean
  locked: boolean
  available: boolean
}

export async function getNestNotificationPreferences(): Promise<
  NestPreferenceCell[]
> {
  try {
    const page = await nestServerFetch<{ items: NestPreferenceCell[] }>(
      "/notification-preferences",
    )
    return page.items ?? []
  } catch {
    return []
  }
}
