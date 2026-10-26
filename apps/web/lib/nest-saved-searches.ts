import { nestServerFetch } from "@/lib/nest-session"

export type NestSavedSearch = {
  id: string
  name: string
  params: Record<string, string>
  listingType: string | null
  minPrice: number | null
  maxPrice: number | null
  currency: string
  alertsEnabled: boolean
  frequency: "DAILY" | "WEEKLY" | "PAUSED"
  resumePath: string
  createdAt: string
  updatedAt: string
}

export async function listNestSavedSearches(): Promise<NestSavedSearch[]> {
  try {
    const page = await nestServerFetch<{ items: NestSavedSearch[] }>(
      "/saved-searches",
    )
    return page.items ?? []
  } catch {
    return []
  }
}

export type NestProjectStatus = {
  projectStatus: "ACTIVE" | "PAUSED" | "COMPLETED"
  projectCompletedAt: string | null
  lastReactivationAt: string | null
}

export async function getNestProjectStatus(): Promise<NestProjectStatus> {
  try {
    return await nestServerFetch<NestProjectStatus>("/retention/project")
  } catch {
    return {
      projectStatus: "ACTIVE",
      projectCompletedAt: null,
      lastReactivationAt: null,
    }
  }
}
