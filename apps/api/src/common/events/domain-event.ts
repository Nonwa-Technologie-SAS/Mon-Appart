export interface DomainEvent<TPayload extends object = Record<string, never>> {
  id: string
  name: string
  occurredAt: string
  aggregateId: string
  payload: TPayload
}
