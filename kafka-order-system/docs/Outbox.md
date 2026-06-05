# Transactional Outbox Pattern

## Problem

When an order is saved to the database but the Kafka publish fails, the system becomes inconsistent:

```
Order saved ✓
Kafka publish ✗
```

Result: Database has the order, but downstream services never receive the event.

## Solution

The Transactional Outbox pattern ensures atomicity between database writes and message publication.

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Save Order  │ ──► │  Save Event  │ ──► │   Commit     │
│  (BEGIN TX)  │     │  to Outbox   │     │  (COMMIT)    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Outbox      │
                     │  Publisher   │
                     │  (Bg Worker) │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │    Kafka     │
                     └──────────────┘
```

### Outbox Table Schema

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);
```

### Flow

1. Begin database transaction
2. Insert order record
3. Insert outbox event record (same transaction)
4. Commit transaction
5. Background `OutboxPublisher` polls for `PENDING` events
6. Publishes events to Kafka
7. Marks events as `PUBLISHED` with `published_at` timestamp
8. On failure, increments `retry_count`; after max retries, marks as `FAILED` and sends to DLQ

### Benefits

- **Atomicity**: Database + event are written together
- **At-least-once delivery**: Publisher retries on failure
- **Ordering**: Events are published in creation order
- **Recovery**: On service restart, unprocessed events are published
- **DLQ integration**: Excessively retried events go to dead letter queue
