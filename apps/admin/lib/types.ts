export interface AdminMe {
  id: string
  name: string | null
  roles: string[]
  /** `["*"]` pour un SUPER_ADMIN. */
  permissions: string[]
  manageableRoles: string[]
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface QueueWidget {
  key: string
  label: string
  definition: string
  value: number
  oldestAt: string | null
  link: string
}

export interface Dashboard {
  computedAt: string
  queues: QueueWidget[]
  analyticsAvailable: boolean
}

export interface AnalyticsOverview {
  range: { from: string; to: string; days: number }
  kpis: Record<string, number | null>
  meta: { computedAt: string | null; completedDay: string | null }
}

export type AccountDecision = "SUSPEND" | "BAN" | "REACTIVATE"

export interface AdminUserSummary {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  emailVerified: boolean
  phoneVerified: boolean
  status: string
  roles: string[]
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminNote {
  id: string
  body: string
  author: { id: string; name: string | null } | null
  createdAt: string
}

export interface AuditEntry {
  at: string
  action: string
  actor: { id: string; name: string | null } | null
  entityType: string
  entityId: string
  oldValues: unknown
  newValues: unknown
  ipAddress: string | null
}

export interface AdminUserDetail extends AdminUserSummary {
  contactRevealed: boolean
  activity: {
    activeSessions: number
    listingsByStatus: Record<string, number>
    managedProperties: number
    reportsFiled: number
    openReportsAgainst: number
    openSignals: number
  }
  verifications: Array<{
    id: string
    type: string
    status: string
    submittedAt: string | null
    decidedAt: string | null
  }>
  notes: AdminNote[]
  audit: AuditEntry[] | null
  actions: {
    decisions: AccountDecision[]
    revokeSessions: boolean
    addNote: boolean
    manageableRoles: string[]
  }
}

export type ModerationDecision =
  "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "SUSPEND" | "RESTORE"

export interface ModerationReason {
  code: string
  action: "REJECT" | "REQUEST_CHANGES" | "SUSPEND"
  label: string
  ownerMessage: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export interface ListingQueueItem {
  id: string
  title: string
  status: string
  listingType: string
  price: { amount: string; currency: string; period: string } | null
  property: {
    id: string
    type: { code: string; name: string }
    neighborhood: string | null
    commune: string | null
  }
  publisher: { id: string; name: string | null }
  openReports: number
  createdAt: string
  updatedAt: string
}

export interface ConsistencyCheck {
  code: string
  outcome: "PASS" | "WARN" | "UNKNOWN"
  detail: string
}

export interface ListingDetail extends Omit<ListingQueueItem, "property"> {
  description: string | null
  publishedAt: string | null
  expiresAt: string | null
  property: {
    id: string
    title: string | null
    status: string
    type: { code: string; name: string }
    surface: number | null
    landSurface: number | null
    bedrooms: number | null
    bathrooms: number | null
    neighborhood: string | null
    commune: string | null
    publicPhotos: number
  }
  history: Array<{
    from: string | null
    to: string
    reason: string | null
    changedBy: string | null
    at: string
  }>
  reports: Array<{
    id: string
    reason: string
    status: string
    createdAt: string
  }>
  checks: ConsistencyCheck[]
  notes: AdminNote[]
  decisions: ModerationDecision[]
  reasons: Partial<Record<ModerationDecision, ModerationReason[]>>
}

export interface ReportItem {
  id: string
  targetType: string
  targetId: string
  reason: string
  description: string | null
  status: string
  priority: string
  action: string | null
  reporterId: string | null
  assignedTo: string | null
  openReportsOnTarget: number
  createdAt: string
  resolvedAt: string | null
  history: Array<{
    action: string
    status: string
    actorId: string | null
    internalNote: string | null
    at: string
  }>
  conversationExcerpt?: Array<{
    id: string
    seq: number
    type: string
    body: string | null
    authorRole: string
    reported: boolean
    createdAt: string
  }>
}

export interface SignalItem {
  id: string
  ruleCode: string
  severity: string
  status: string
  userId: string | null
  listingId: string | null
  verificationId: string | null
  details: Record<string, unknown>
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export interface VerificationQueueItem {
  id: string
  type: string
  status: string
  priority: string
  assignedTo: string | null
  subjectId: string
  propertyId: string | null
  listingId: string | null
  documents: number
  submittedAt: string | null
  createdAt: string
}

export interface VerificationDetail {
  id: string
  type: string
  status: string
  priority: string
  assignedTo: string | null
  claimedRelation: string | null
  reason: { code: string; message: string } | null
  declaration: Record<string, unknown>
  submittedAt: string | null
  decidedAt: string | null
  verifiedAt: string | null
  expiresAt: string | null
  subject: {
    userId: string
    firstName: string | null
    lastName: string | null
    phoneVerified: boolean
    emailVerified: boolean
  }
  property: { id: string; title: string } | null
  listing: { id: string; title: string } | null
  prechecks: Record<string, unknown>
  requirements: { missing: string[][] } | null
  documents: Array<{
    id: string
    documentType: string
    status: string
    mimeType: string
    fileSize: number
    scan: string | null
    createdAt: string
  }>
  history: Array<{
    action: string
    status: string
    actorKind: string
    actorId: string | null
    reason: { code: string; message: string } | null
    message: string | null
    internalNote: string | null
    at: string
  }>
  signals: Array<{
    id: string
    ruleCode: string
    severity: string
    status: string
    createdAt: string
  }>
}

export interface RoleView {
  code: string
  name: string
  description: string | null
  permissions: string[]
}

// ------------------------------------------------------------ facturation
// Montants : entiers en chaîne (jamais de flottant), devise ISO.

export interface BillingPerson {
  id: string
  name: string | null
}

export interface BillingOrder {
  id: string
  kind: string
  status: string
  product: { code: string; name: string }
  amount: string
  currency: string
  intervalMonths: number
  maxActiveListings: number | null
  expiresAt: string
  paidAt: string | null
  fulfilled: boolean
  cancelledAt: string | null
  refundedAt: string | null
  createdAt: string
  buyer: BillingPerson
}

export interface BillingPayment {
  id: string
  orderId: string
  provider: string
  environment: "TEST" | "LIVE"
  status: string
  amount: string
  currency: string
  failureCode: string | null
  refundedAmount: string
  expiresAt: string
  succeededAt: string | null
  createdAt: string
  buyer?: BillingPerson
  checkAttempts: number
  lastCheckedAt: string | null
}

export interface BillingRefund {
  id: string
  paymentId: string
  orderId: string
  amount: string
  currency: string
  status: string
  reason: string
  requestedByCustomer: boolean
  decisionNote: string | null
  failureCode: string | null
  decidedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface BillingWebhookEvent {
  provider: string
  eventId: string
  paymentId: string | null
  signatureValid: boolean
  outcome: string
  errorCode: string | null
  summary: unknown
  attempts: number
  receivedAt: string
  processedAt: string | null
}

export interface BillingIncident {
  id: string
  kind: string
  status: string
  paymentId: string | null
  orderId: string | null
  detail: unknown
  resolution: string | null
  resolvedBy: BillingPerson | null
  resolvedAt: string | null
  createdAt: string
}

export interface BillingOrderDetail extends BillingOrder {
  payments: Array<
    BillingPayment & {
      events: BillingWebhookEvent[]
      refunds: BillingRefund[]
    }
  >
  incidents: BillingIncident[]
  period: {
    periodStart: string
    periodEnd: string
    revokedAt: string | null
    subscriptionId: string
    subscriptionStatus: string
  } | null
}

export interface BillingSubscription {
  id: string
  status: string
  product: { code: string; name: string }
  maxActiveListings: number | null
  intervalMonths: number
  currentPeriodStart: string
  currentPeriodEnd: string
  graceEndsAt: string
  cancelAtPeriodEnd: boolean
  endedAt: string | null
  renewalOpen: boolean
  user: BillingPerson
}

export interface BillingPrice {
  id: string
  amount: string
  currency: string
  intervalMonths: number
  status: string
  validFrom: string
  validUntil: string | null
}

export interface BillingProduct {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  isDefault: boolean
  maxActiveListings: number | null
  sortOrder: number
  currentPrice: BillingPrice | null
  prices: BillingPrice[]
  updatedAt: string
}

export interface BillingSummary {
  computedAt: string
  provider: {
    code: string
    environment: "TEST" | "LIVE"
    simulated: boolean
    refunds: boolean
  } | null
  collected: Array<{
    currency: string
    environment: string
    amount: string
    payments: number
  }>
  refunded: Array<{ currency: string; amount: string; refunds: number }>
  ordersByStatus: Record<string, number>
  subscriptionsByStatus: Record<string, number>
  openIncidents: number
  pendingRefunds: number
  definitions: Record<string, string>
}
