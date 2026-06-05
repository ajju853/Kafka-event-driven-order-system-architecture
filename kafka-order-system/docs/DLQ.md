# Dead Letter Queue (DLQ)

## Purpose

The Dead Letter Queue captures events that cannot be processed after exhausting retry attempts. This prevents:

- Message loss in the system
- Infinite retry loops
- Poison pill messages blocking consumer progress

## DLQ Topic

```
Topic: dlq-events
Partitions: 1
Retention: 30 days
```

## DLQ Event Format

```json
{
  "originalEvent": { "eventId": "uuid", "eventType": "ORDER_CREATED", ... },
  "errorMessage": "Payment declined: insufficient funds",
  "failedAt": "2026-06-05T12:00:00.000Z",
  "consumerGroup": "payment-service-group",
  "topic": "inventory-reserved"
}
```

## DLQ Sources

| Source | Condition |
|--------|-----------|
| Order Service | Outbox event fails to publish after 3 retries |
| Inventory Service | Error processing inventory reservation |
| Payment Service | Error processing payment |
| Notification Service | Error sending notifications |
| Analytics Service | Error recording metrics |

## DLQ Replay Service

The DLQ Replay Service runs on port **4007** and provides:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dlq/events` | GET | List all failed events (supports `?limit=&offset=`) |
| `/dlq/events/:eventId` | GET | Get single failed event details |
| `/dlq/replay/:eventId` | POST | Replay a specific event to its original topic |
| `/dlq/replay-all` | POST | Replay all failed events |

### Database Schema

```sql
CREATE TABLE dlq_events (
  event_id        VARCHAR(255) PRIMARY KEY,
  original_payload TEXT NOT NULL,
  error_message   TEXT,
  consumer_group  VARCHAR(255) NOT NULL,
  source_topic    VARCHAR(255) NOT NULL,
  failed_at       TIMESTAMP WITH TIME ZONE,
  replayed        BOOLEAN DEFAULT FALSE,
  replayed_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Replay Flow

1. Operator identifies failed events via `GET /dlq/events`
2. Root cause is investigated and fixed
3. Operator calls `POST /dlq/replay/{eventId}` to re-publish to the original topic
4. Target service processes the replayed event
5. If successful, `dlq_events.replayed` is set to `true`

## Automated Monitoring

- Alert when DLQ message count exceeds threshold
- Track DLQ message age
- Categorize errors by type for root cause analysis

## Recovery Steps

1. Check `GET /dlq/events` for failed events
2. Identify the root cause (inventory shortage, payment failure, schema mismatch, etc.)
3. Fix the underlying issue
4. Call `POST /dlq/replay/{eventId}` to replay
5. Verify successful processing in target service

## Grafana Dashboard Metrics

```
dlq_messages_total{service="order-service"}
dlq_messages_by_error_type{error_type="payment_failed"}
dlq_message_age_seconds
dlq_replay_count{status="success"}
```
