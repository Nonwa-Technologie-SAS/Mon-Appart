import { z } from "zod"

import {
  EVENTS,
  isEventName,
  type EventDefinition,
  type EventName,
  type EventOrigin,
} from "./catalog"

/** Bornes du contrat ; le serveur peut appliquer des limites plus basses. */
export const MAX_BATCH_EVENTS = 100
export const MAX_PROPERTIES_BYTES = 2_048

export const CLIENT_SOURCES = ["web", "mobile"] as const
export type ClientSource = (typeof CLIENT_SOURCES)[number]

/**
 * Lot envoyé par un client. Le contexte est commun aux événements : il évite
 * de répéter les identifiants et ne contient rien d'identifiant en clair.
 */
export const batchSchema = z.strictObject({
  context: z.strictObject({
    source: z.enum(CLIENT_SOURCES),
    /** Identifiant pseudonyme aléatoire, seulement avec consentement. */
    anonymousId: z.uuid().optional(),
    /** Identifiant de visite aléatoire, renouvelé après inactivité. */
    sessionId: z.uuid().optional(),
    appVersion: z
      .string()
      .regex(/^[0-9A-Za-z.+-]{1,32}$/)
      .optional(),
    consent: z.strictObject({
      analytics: z.boolean(),
      policyVersion: z.string().regex(/^[0-9A-Za-z._-]{1,20}$/),
    }),
    /** Horloge du client à l'envoi : sert à corriger un décalage d'horloge. */
    sentAt: z.iso.datetime({ offset: true }),
  }),
  events: z
    .array(
      z.strictObject({
        eventId: z.uuid(),
        name: z.string().min(1).max(64),
        schemaVersion: z.int().min(1).max(100),
        occurredAt: z.iso.datetime({ offset: true }),
        properties: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(MAX_BATCH_EVENTS),
})

export type AnalyticsBatch = z.infer<typeof batchSchema>
export type AnalyticsBatchInput = z.input<typeof batchSchema>
export type IncomingEvent = AnalyticsBatch["events"][number]

export type RejectionReason =
  | "unknown_event"
  | "server_only_event"
  | "unsupported_version"
  | "forbidden_property"
  | "properties_too_large"
  | "invalid_properties"

export type ValidationResult =
  | {
      ok: true
      name: EventName
      definition: EventDefinition
      properties: Record<string, unknown>
    }
  | { ok: false; reason: RejectionReason }

/**
 * Noms de clés qui trahissent une donnée à ne jamais collecter. Contrôle
 * défensif en plus des objets stricts : il rend le refus explicite.
 */
const FORBIDDEN_WORDS = new Set([
  "pass",
  "passwd",
  "password",
  "pwd",
  "token",
  "otp",
  "secret",
  "email",
  "mail",
  "phone",
  "tel",
  "telephone",
  "msisdn",
  "message",
  "body",
  "content",
  "text",
  "iban",
  "card",
  "cni",
  "passport",
  "document",
  "url",
  "uri",
  "href",
  "address",
  "adresse",
  "latitude",
  "longitude",
  "lat",
  "lng",
  "ip",
])

/** Compare mot à mot (camelCase, snake_case) : `context` ne contient pas `text`. */
function isForbiddenKey(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => FORBIDDEN_WORDS.has(word))
}

export function findForbiddenKey(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || typeof value !== "object") return null
  for (const [key, nested] of Object.entries(value)) {
    if (isForbiddenKey(key)) return key
    const found = findForbiddenKey(nested, depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Valide un événement selon le catalogue. `origin` est l'émetteur réel : un
 * client ne peut pas produire un événement réservé au backend.
 */
export function validateEvent(
  name: string,
  version: number,
  properties: unknown,
  origin: EventOrigin,
): ValidationResult {
  if (!isEventName(name)) return { ok: false, reason: "unknown_event" }
  const definition: EventDefinition = EVENTS[name]
  if (origin === "client" && definition.origin !== "client") {
    return { ok: false, reason: "server_only_event" }
  }
  const schema =
    version === definition.version
      ? definition.schema
      : definition.legacy?.[version]
  if (!schema) return { ok: false, reason: "unsupported_version" }
  if (findForbiddenKey(properties)) {
    return { ok: false, reason: "forbidden_property" }
  }
  if (byteLength(JSON.stringify(properties ?? {})) > MAX_PROPERTIES_BYTES) {
    return { ok: false, reason: "properties_too_large" }
  }
  const parsed = schema.safeParse(properties ?? {})
  if (!parsed.success) return { ok: false, reason: "invalid_properties" }
  return {
    ok: true,
    name,
    definition,
    properties: parsed.data as Record<string, unknown>,
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
