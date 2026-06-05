# Kafka Design

## Topics

| Topic | Partitions | Retention | Producers | Consumers |
|-------|-----------|-----------|-----------|-----------|
| `order-created` | 3 | 7 days | Order Service | Inventory, Notification, Analytics, Audit |
| `order-cancelled` | 3 | 7 days | Order Service | Inventory (release), Notification, Audit |
| `inventory-reserved` | 3 | 7 days | Inventory Service | Payment, Notification, Analytics, Audit |
| `inventory-failed` | 3 | 7 days | Inventory Service | Notification, Audit |
| `inventory-release` | 3 | 7 days | Payment Service, Order Service | Inventory Service |
| `payment-processed` | 3 | 7 days | Payment Service | Notification, Analytics, Audit |
| `payment-failed` | 3 | 7 days | Payment Service | Notification, Audit, Inventory (release) |
| `dlq-events` | 1 | 30 days | All services | DLQ Replay Service |

## Consumer Groups

| Group | Services | Topics Consumed |
|-------|----------|-----------------|
| `order-service-group` | Order Service | (Producer only) |
| `inventory-service-group` | Inventory Service | order-created, inventory-release |
| `payment-service-group` | Payment Service | inventory-reserved |
| `notification-service-group` | Notification Service | All order/payment events |
| `analytics-service-group` | Analytics Service | order-created, inventory-reserved, payment-processed, inventory-failed |
| `audit-service-group` | Audit Service | All topics |
| `dlq-replay-group` | DLQ Replay Service | dlq-events |

## Producer Configuration

```typescript
{
  maxInFlightRequests: 1,
  idempotent: true,
}
```

- `idempotent: true` prevents duplicate message production within producer sessions
- Single in-flight request maintains per-partition ordering

## Consumer Configuration

```typescript
{
  groupId: "payment-service-group",
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  retry: {
    initialRetryTime: 1000,
    retries: 5,
  },
}
```

- Consumer-side idempotency via `processed_events` table
- Exponential backoff with configurable retry count
- Session timeout + heartbeat for rebalance detection

## Event Schemas

### JSON Schema (Runtime)

Events are validated at the application layer using Zod:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "ORDER_CREATED",
  "orderId": "550e8400-e29b-41d4-a716-446655440001",
  "customerId": "550e8400-e29b-41d4-a716-446655440002",
  "items": [
    { "productId": "uuid", "quantity": 2, "price": 29.99 }
  ],
  "totalAmount": 59.98,
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  },
  "timestamp": "2026-06-05T12:00:00.000Z",
  "version": 1
}
```

All events include:
- `eventId` (UUID) — unique identifier for deduplication
- `eventType` — discriminator for routing
- `timestamp` — event creation time
- `version` — schema version for evolution

### Avro Schema (Confluent Schema Registry)

For production deployments, events are registered in the Schema Registry as Avro schemas:

```
Schema Registry: http://localhost:8081

Subjects:
  order-created-value    (v1, v2)
  inventory-reserved-value (v1)
  payment-processed-value   (v1)
  payment-failed-value      (v1)
```

#### order-created-v1 (Avro)

```avro
{
  "type": "record",
  "name": "OrderCreated",
  "namespace": "com.ordersystem.event",
  "fields": [
    { "name": "eventId",   "type": "string", "doc": "Unique event identifier" },
    { "name": "eventType", "type": "string", "doc": "Event discriminator" },
    { "name": "orderId",   "type": "string" },
    { "name": "customerId","type": "string" },
    { "name": "items",     "type": { "type": "array", "items": {
      "type": "record", "name": "OrderItem",
      "fields": [
        { "name": "productId", "type": "string" },
        { "name": "quantity",  "type": "int" },
        { "name": "price",     "type": "double" }
      ]
    }}},
    { "name": "totalAmount",     "type": "double" },
    { "name": "shippingAddress", "type": "string" },
    { "name": "timestamp",       "type": "string" },
    { "name": "version",         "type": "int", "default": 1 }
  ]
}
```

#### order-created-v2 (Backward Compatible)

```avro
{
  "type": "record",
  "name": "OrderCreated",
  "namespace": "com.ordersystem.event",
  "fields": [
    { "name": "eventId",   "type": "string" },
    { "name": "eventType", "type": "string" },
    { "name": "orderId",   "type": "string" },
    { "name": "customerId","type": "string" },
    { "name": "items",     "type": { "type": "array", "items": "OrderItem" }},
    { "name": "totalAmount",     "type": "double" },
    { "name": "shippingAddress", "type": "string" },
    { "name": "timestamp",       "type": "string" },
    { "name": "version",         "type": "int", "default": 1 },
    { "name": "couponCode",      "type": ["null", "string"], "default": null }
  ]
}
```

Version 2 adds `couponCode` as an optional field (Avro union with null) to maintain backward compatibility.

## Exactly-Once Semantics

| Layer | Guarantee | Mechanism |
|-------|-----------|-----------|
| Kafka broker | At-Least-Once | Default delivery semantics |
| Producer | Idempotent | `enable.idempotence=true` |
| Consumer | Effectively-Once | `processed_events` dedup table |
| Application | Effectively-Once | Outbox pattern + idempotent consumers |

The outbox pattern writes the event and business data atomically in a single database transaction. The outbox publisher picks up unprocessed events and publishes them to Kafka. On the consumer side, each event ID is checked against a `processed_events` table — if already processed, it is silently skipped.

This approach avoids the complexity of Kafka transactions (transaction coordinators, zombie fencing) while providing exactly-once processing guarantees at the application level.
