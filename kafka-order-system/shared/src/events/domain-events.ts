export interface DomainEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  timestamp: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StoredEvent extends DomainEvent {
  id: string;
  createdAt: Date;
}
