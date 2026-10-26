/**
 * Enveloppe commune des événements de domaine.
 * `id` est l'`eventId` stable (UUID) ; `name` est le type (`listing.published`).
 * Les champs d'observabilité sont facultatifs pour rester compatible avec
 * les publications en processus encore hors outbox (ex. connexion).
 */
export interface DomainEvent<TPayload extends object = Record<string, never>> {
  id: string
  name: string
  occurredAt: string
  aggregateId: string
  payload: TPayload
  eventVersion?: number
  publishedAt?: string
  producer?: string
  aggregateType?: string
  correlationId?: string | null
  causationId?: string | null
  traceId?: string | null
}
