import { OUTBOX_MAX_PAYLOAD_BYTES } from "./outbox.constants"

const EVENT_TYPE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,4}$/
const PRODUCER = /^[a-z][a-z0-9-]{1,78}$/
const AGGREGATE = /^[a-z][a-z0-9_]{1,78}$/
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const FORBIDDEN_KEY =
  /^(password|passwd|secret|token|otp|refresh.?token|access.?token|authorization|iban|card|cvv|document|identity.?document|ssn|pin)$/i

const FORBIDDEN_NESTED = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "otp",
  "refreshToken",
  "accessToken",
  "authorization",
  "iban",
  "cardNumber",
  "cvv",
])

export interface OutboxDraft {
  name: string
  producer: string
  aggregateType: string
  aggregateId: string
  payload: object
  correlationId?: string | null
  causationId?: string | null
  traceId?: string | null
  eventVersion?: number
  occurredAt?: Date
}

export function assertOutboxDraft(draft: OutboxDraft): void {
  if (!EVENT_TYPE.test(draft.name)) {
    throw new Error(`INVALID_EVENT: type ${draft.name}`)
  }
  if (!PRODUCER.test(draft.producer)) {
    throw new Error(`INVALID_EVENT: producer ${draft.producer}`)
  }
  if (!AGGREGATE.test(draft.aggregateType)) {
    throw new Error(`INVALID_EVENT: aggregate ${draft.aggregateType}`)
  }
  if (!UUID.test(draft.aggregateId)) {
    throw new Error("INVALID_EVENT: aggregateId")
  }
  if (draft.correlationId && !UUID.test(draft.correlationId)) {
    draft.correlationId = null
  }
  if (draft.causationId && !UUID.test(draft.causationId)) {
    draft.causationId = null
  }
  assertSafePayload(draft.payload)
}

export function assertSafePayload(payload: object): void {
  if (
    payload === null ||
    Array.isArray(payload) ||
    typeof payload !== "object"
  ) {
    throw new Error("INVALID_EVENT: payload")
  }
  const json = JSON.stringify(payload)
  if (json.length > OUTBOX_MAX_PAYLOAD_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE")
  }
  scanKeys(payload, 0)
}

function scanKeys(value: unknown, depth: number): void {
  if (depth > 4 || value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const item of value) scanKeys(item, depth + 1)
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key) || FORBIDDEN_NESTED.has(key)) {
      throw new Error(`FORBIDDEN_PAYLOAD: ${key}`)
    }
    scanKeys(nested, depth + 1)
  }
}

export function sanitizeOutboxError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown"
  return raw.replace(/\s+/g, " ").slice(0, 200)
}
