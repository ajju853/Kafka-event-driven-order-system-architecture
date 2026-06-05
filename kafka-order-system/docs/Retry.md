# Retry System

## Consumer Retry Strategy

When a Kafka consumer fails to process an event, the system uses an exponential backoff retry strategy before sending the event to the Dead Letter Queue (DLQ).

### Configuration

```typescript
{
  maxRetries: 3,
  initialBackoffMs: 5000,
  backoffMultiplier: 3,
}
```

### Retry Backoff Intervals

| Attempt | Backoff Duration | Cumulative Time |
|---------|-----------------|-----------------|
| 1 | 5 seconds | 5 seconds |
| 2 | 30 seconds | 35 seconds |
| 3 | 120 seconds | 155 seconds |

### Retry Flow

```
Event Received
     │
     ▼
┌─────────────┐
│ Process     │
│ Event       │
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  OK       FAIL
  │         │
  │    ┌────▼────┐
  │    │ Retry   │
  │    │ Count   │
  │    │ >= Max? │
  │    └────┬────┘
  │    ┌────┴────┐
  │    │         │
  │    NO       YES
  │    │         │
  │    │    ┌────▼────┐
  │    │    │ Send    │
  │    │    │ to DLQ  │
  │    │    └─────────┘
  │    │
  │    │ Wait (backoff)
  │    │
  └────┴────► Retry
```

### Implementation

In the Order Service's `OutboxPublisher`, failed outbox events increment `retry_count` and are re-attempted on the next poll cycle. Events exceeding `maxRetries` are marked `FAILED` and sent to the DLQ topic.

In consumers like the Inventory Service, errors are caught and events are sent directly to DLQ with error context after logging the failure.

### Best Practices

1. Always use exponential backoff (not fixed intervals)
2. Include jitter to prevent thundering herd
3. Log retry attempts with full error context
4. Set an upper bound on retries (3-5)
5. Route permanently failed events to DLQ
