import { nestServerFetch } from "@/lib/nest-session"

export type InquiryListItem = {
  id: string
  type: string
  status: string
  stage: string
  createdAt: string
  lastActivityAt: string
  nextAction: string | null
  nextActionAt: string | null
  budgetAmount: number | null
  firstRespondedAt: string | null
  prospect: { id: string; displayName: string }
  assignee: { id: string; displayName: string } | null
  listing: { id: string; title: string; listingType: string; status: string }
  conversationId: string | null
  appointments: Array<{ id: string; status: string; scheduledAt: string }>
  priority: "HIGH" | "MEDIUM" | "LOW"
  priorityReasons: string[]
  suggestedAction: string
}

export type InquiryDetail = InquiryListItem & {
  message: string | null
  desiredZone: string | null
  desiredMoveAt: string | null
  lostReason: string | null
  notes: Array<{
    id: string
    body: string
    createdAt: string
    author: { id: string; displayName: string }
  }>
  stageHistory: Array<{
    fromStage: string | null
    toStage: string
    reason: string | null
    createdAt: string
    author: { id: string; displayName: string }
  }>
}

export type InquiryDashboard = {
  windowDays: number
  newContacts: number
  unhandled: number
  overdueActions: number
  pendingVisits: number
  confirmedUpcomingVisits: number
  completedVisits: number
  responseRate: number | null
  medianFirstResponseHours: number | null
  contactToVisitRate: number | null
  totals: { inquiries: number; responded: number }
  topListings?: Array<{ id: string; title: string; contacts: number }>
  computedAt: string
}

export type ConversationMessage = {
  id: string
  seq: number
  type: string
  body: string | null
  systemCode: string | null
  mine: boolean
  createdAt: string
  author: { displayName?: string | null } | null
  safetyHints?: Array<{
    code: string
    severity: string
    userMessage: string
  }>
}

export async function listConversationMessages(conversationId: string) {
  try {
    const page = await nestServerFetch<{ items: ConversationMessage[] }>(
      `/conversations/${conversationId}/messages`,
      { query: { limit: 40 } },
    )
    return page.items ?? []
  } catch {
    return [] as ConversationMessage[]
  }
}

export async function listNestInquiries(query: Record<string, string> = {}) {
  try {
    return await nestServerFetch<{
      items: InquiryListItem[]
      nextCursor: string | null
    }>("/inquiries", { query })
  } catch {
    return { items: [] as InquiryListItem[], nextCursor: null }
  }
}

export async function getNestInquiry(id: string) {
  return nestServerFetch<InquiryDetail>(`/inquiries/${id}`)
}

export async function getInquiryDashboard() {
  try {
    return await nestServerFetch<InquiryDashboard>("/inquiries/dashboard")
  } catch {
    return null
  }
}
