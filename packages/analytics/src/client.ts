import type {
  ClientEventName,
  EventDefinition,
  EventProperties,
} from "./catalog"
import { EVENTS } from "./catalog"
import {
  validateEvent,
  type AnalyticsBatchInput,
  type ClientSource,
} from "./validation"

export interface TrackerTransport {
  /** Envoie un lot ; renvoie le statut HTTP, ou lève en cas d'erreur réseau. */
  send(batch: AnalyticsBatchInput): Promise<{ status: number }>
}

/** Stockage persistant (localStorage, AsyncStorage) ; synchrone ou non. */
export interface TrackerStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export type DropReason =
  | "no_consent"
  | "invalid_event"
  | "duplicate"
  | "queue_full"
  | "rejected_by_server"
  | "retries_exhausted"

export interface TrackerOptions {
  source: ClientSource
  /** Version de la politique de confidentialité acceptée. */
  policyVersion: string
  transport: TrackerTransport
  storage?: TrackerStorage
  appVersion?: string
  /** UUID v4 aléatoire ; obligatoire si `crypto.randomUUID` est absent. */
  randomId?: () => string
  now?: () => number
  batchSize?: number
  maxQueue?: number
  maxAttempts?: number
  retryBaseMs?: number
  sessionTimeoutMs?: number
  anonymousIdTtlMs?: number
  /** Fenêtre anti-doublon par événement, en millisecondes. */
  dedupWindowsMs?: Partial<Record<ClientEventName, number>>
  onDrop?: (name: string, reason: DropReason) => void
}

interface QueuedEvent {
  eventId: string
  name: ClientEventName
  schemaVersion: number
  occurredAt: string
  properties: Record<string, unknown>
  attempts: number
  notBefore: number
}

const ANONYMOUS_KEY = "mon-appart:analytics:anonymous:v1"
const MINUTE = 60_000

/**
 * Anti-doublon par défaut : rerender React, préchargement, retour arrière.
 * Une même fiche n'est comptée qu'une fois par demi-heure et par appareil.
 */
const DEFAULT_DEDUP: Partial<Record<ClientEventName, number>> = {
  app_opened: 30 * MINUTE,
  page_viewed: 1_000,
  search_results_viewed: 2_000,
  map_results_viewed: 2_000,
  listing_card_viewed: 30 * MINUTE,
  listing_detail_viewed: 30 * MINUTE,
  recommendations_viewed: 30 * MINUTE,
  recommended_listing_opened: 30 * MINUTE,
  listing_creation_started: 5 * MINUTE,
}

/** Clé d'identité d'un événement pour l'anti-doublon. */
function dedupKey(name: ClientEventName, properties: Record<string, unknown>) {
  switch (name) {
    case "listing_detail_viewed":
      return `${name}:${String(properties.listingId)}`
    case "listing_card_viewed":
      return `${name}:${String(properties.listingId)}:${String(properties.context)}`
    case "recommendations_viewed":
      return `${name}:${String(properties.recommendationRequestId)}`
    case "recommended_listing_opened":
      return `${name}:${String(properties.recommendationRequestId)}:${String(properties.listingId)}`
    default:
      return `${name}:${stableStringify(properties)}`
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`
}

/**
 * Client de tracking partagé (web, mobile). N'envoie rien sans consentement,
 * ne bloque jamais l'interface (`track` est synchrone), regroupe les
 * événements et rejoue les échecs temporaires avec le même `eventId`, ce qui
 * rend les rejeux idempotents côté serveur. Aucune empreinte d'appareil.
 */
export class Tracker {
  private readonly options: Required<
    Omit<TrackerOptions, "storage" | "appVersion" | "onDrop" | "dedupWindowsMs">
  > &
    Pick<TrackerOptions, "storage" | "appVersion" | "onDrop">
  private readonly dedupWindows: Partial<Record<ClientEventName, number>>
  private readonly recent = new Map<string, number>()
  private queue: QueuedEvent[] = []
  private consent = false
  private sessionId: string | null = null
  private lastActivity = 0
  private anonymousId: { id: string; at: number } | null = null
  private flushing: Promise<void> | null = null

  constructor(options: TrackerOptions) {
    const randomId =
      options.randomId ??
      (typeof globalThis.crypto?.randomUUID === "function"
        ? () => globalThis.crypto.randomUUID()
        : null)
    if (!randomId) {
      throw new Error("Tracker : fournir `randomId` (UUID v4 aléatoire)")
    }
    this.options = {
      source: options.source,
      policyVersion: options.policyVersion,
      transport: options.transport,
      storage: options.storage,
      appVersion: options.appVersion,
      onDrop: options.onDrop,
      randomId,
      now: options.now ?? (() => Date.now()),
      batchSize: options.batchSize ?? 20,
      maxQueue: options.maxQueue ?? 200,
      maxAttempts: options.maxAttempts ?? 5,
      retryBaseMs: options.retryBaseMs ?? 2_000,
      sessionTimeoutMs: options.sessionTimeoutMs ?? 30 * MINUTE,
      anonymousIdTtlMs: options.anonymousIdTtlMs ?? 30 * 24 * 60 * MINUTE,
    }
    this.dedupWindows = { ...DEFAULT_DEDUP, ...options.dedupWindowsMs }
  }

  get hasConsent(): boolean {
    return this.consent
  }

  get pending(): number {
    return this.queue.length
  }

  /**
   * Consentement analytique. Un retrait vide la file, oublie la session et
   * efface l'identifiant pseudonyme persistant.
   */
  async setConsent(granted: boolean): Promise<void> {
    this.consent = granted
    if (granted) return
    this.queue = []
    this.recent.clear()
    this.sessionId = null
    this.anonymousId = null
    await this.options.storage?.removeItem(ANONYMOUS_KEY)
  }

  /** Synchrone et sans exception : l'interface n'attend jamais Analytics. */
  track<TName extends ClientEventName>(
    name: TName,
    properties: EventProperties<TName>,
  ): boolean {
    if (!this.consent) return this.drop(name, "no_consent")
    const definition = (EVENTS as Record<string, EventDefinition | undefined>)[
      name
    ]
    if (!definition) return this.drop(name, "invalid_event")
    const result = validateEvent(name, definition.version, properties, "client")
    if (!result.ok) return this.drop(name, "invalid_event")

    const now = this.options.now()
    const window = this.dedupWindows[name] ?? 0
    if (window > 0) {
      const key = dedupKey(name, result.properties)
      const last = this.recent.get(key)
      if (last !== undefined && now - last < window) {
        return this.drop(name, "duplicate")
      }
      this.recent.set(key, now)
      this.pruneRecent(now)
    }

    if (this.queue.length >= this.options.maxQueue) {
      const oldest = this.queue.shift()
      if (oldest) this.options.onDrop?.(oldest.name, "queue_full")
    }
    this.touchSession(now)
    this.queue.push({
      eventId: this.options.randomId(),
      name,
      schemaVersion: definition.version,
      occurredAt: new Date(now).toISOString(),
      properties: result.properties,
      attempts: 0,
      notBefore: 0,
    })
    return true
  }

  /** Envoie les événements prêts, un lot à la fois ; jamais en parallèle. */
  flush(): Promise<void> {
    this.flushing ??= this.drain().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async drain(): Promise<void> {
    while (this.consent) {
      const now = this.options.now()
      const ready = this.queue
        .filter((item) => item.notBefore <= now)
        .slice(0, this.options.batchSize)
      if (ready.length === 0) return
      const sent = await this.sendBatch(ready, now)
      if (!sent) return
    }
  }

  /** Vrai si le lot est réglé (accepté ou refusé définitivement). */
  private async sendBatch(items: QueuedEvent[], now: number): Promise<boolean> {
    const batch: AnalyticsBatchInput = {
      context: {
        source: this.options.source,
        anonymousId: (await this.loadAnonymousId(now)) ?? undefined,
        sessionId: this.sessionId ?? undefined,
        appVersion: this.options.appVersion,
        consent: { analytics: true, policyVersion: this.options.policyVersion },
        sentAt: new Date(now).toISOString(),
      },
      events: items.map((item) => ({
        eventId: item.eventId,
        name: item.name,
        schemaVersion: item.schemaVersion,
        occurredAt: item.occurredAt,
        properties: item.properties,
      })),
    }
    let status: number
    try {
      status = (await this.options.transport.send(batch)).status
    } catch {
      status = 0
    }
    if (status >= 200 && status < 300) {
      this.remove(items)
      return true
    }
    const temporary =
      status === 0 || status === 408 || status === 429 || status >= 500
    if (!temporary) {
      this.remove(items)
      for (const item of items) {
        this.options.onDrop?.(item.name, "rejected_by_server")
      }
      return true
    }
    for (const item of items) {
      item.attempts += 1
      item.notBefore =
        now + this.options.retryBaseMs * 2 ** Math.min(item.attempts - 1, 6)
    }
    const exhausted = items.filter(
      (item) => item.attempts >= this.options.maxAttempts,
    )
    this.remove(exhausted)
    for (const item of exhausted) {
      this.options.onDrop?.(item.name, "retries_exhausted")
    }
    return false
  }

  private remove(items: QueuedEvent[]): void {
    if (items.length === 0) return
    const ids = new Set(items.map((item) => item.eventId))
    this.queue = this.queue.filter((item) => !ids.has(item.eventId))
  }

  private touchSession(now: number): void {
    if (
      this.sessionId === null ||
      now - this.lastActivity > this.options.sessionTimeoutMs
    ) {
      this.sessionId = this.options.randomId()
    }
    this.lastActivity = now
  }

  /** Identifiant pseudonyme persistant, renouvelé après sa durée de vie. */
  private async loadAnonymousId(now: number): Promise<string | null> {
    const fresh = (value: { id: string; at: number } | null) =>
      value !== null && now - value.at < this.options.anonymousIdTtlMs
    if (fresh(this.anonymousId)) return this.anonymousId!.id
    const storage = this.options.storage
    if (!storage) return null
    try {
      const raw = await storage.getItem(ANONYMOUS_KEY)
      const stored = raw
        ? (JSON.parse(raw) as { id?: unknown; at?: unknown })
        : null
      if (typeof stored?.id === "string" && typeof stored.at === "number") {
        const candidate = { id: stored.id, at: stored.at }
        if (fresh(candidate)) {
          this.anonymousId = candidate
          return candidate.id
        }
      }
      const created = { id: this.options.randomId(), at: now }
      await storage.setItem(ANONYMOUS_KEY, JSON.stringify(created))
      this.anonymousId = created
      return created.id
    } catch {
      return null
    }
  }

  private pruneRecent(now: number): void {
    if (this.recent.size < 500) return
    for (const [key, at] of this.recent) {
      if (now - at > 30 * MINUTE) this.recent.delete(key)
    }
  }

  private drop(name: string, reason: DropReason): false {
    this.options.onDrop?.(name, reason)
    return false
  }
}

/** Transport `fetch` ; `keepalive` permet l'envoi à la fermeture d'une page. */
export function createFetchTransport(
  endpoint: string,
  init: {
    fetch?: typeof fetch
    headers?: () => Record<string, string>
    credentials?: "include" | "omit" | "same-origin"
  } = {},
): TrackerTransport {
  const send = init.fetch ?? globalThis.fetch
  return {
    async send(batch) {
      const response = await send(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...init.headers?.() },
        body: JSON.stringify(batch),
        credentials: init.credentials ?? "include",
        keepalive: true,
      })
      return { status: response.status }
    },
  }
}
