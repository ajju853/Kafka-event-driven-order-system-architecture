# High-Level Design (HLD)

## Architecture Overview

```
                        ┌───────────────────┐
                        │   Next.js         │
                        │   Frontend        │
                        └────────┬──────────┘
                                 │ REST (port 3000)
                                 ▼
   ┌─────────────────────────────────────────────────┐
   │           API Gateway (Order Service)            │
   │  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
   │  │ JWT Auth  │  │Rate Limit│  │ Request Logging│ │
   │  └──────────┘  └──────────┘  └────────────────┘ │
   │  ┌─────────────────────────────────────────────┐ │
   │  │         Transactional Outbox Pattern        │ │
   │  └─────────────────────────────────────────────┘ │
   └──────────────────────┬──────────────────────────┘
                          │ Kafka Producer
                          ▼
   ╔══════════════════════════════════════════════════╗
   ║              Apache Kafka Broker                 ║
   ║  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌─────┐ ║
   ║  │order-│ │invent│ │payment │ │dlq-  │ │.....│ ║
   ║  │create│ │-resrv│ │-proc   │ │events│ │     │ ║
   ║  └──┬───┘ └──┬───┘ └───┬────┘ └──┬───┘ └─────┘ ║
   ╚══════╪════════╪═════════╪═════════╪══════════════╝
          │        │         │         │
   ┌──────┘  ┌─────┘   ┌────┘    ┌────┘
   ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│Inventory│ │Payment │ │Notific │ │ Analytics    │
│Service  │ │Service │ │Service │ │ Service      │
│(Redis)  │ │(PG)    │ │        │ │ (PG)         │
└────┬────┘ └───┬────┘ └────────┘ └──────────────┘
     │          │                              ┌──────────────┐
     ▼          ▼                              │ Audit        │
┌────────┐ ┌────────┐                          │ Service      │
│Order   │ │DLQ     │                          │ (PG)         │
│Service │ │Replay  │                          └──────────────┘
│(PG,    │ │Service │
│Redis)  │ │(PG)    │
└────────┘ └────────┘

   ┌──────────────────────────┐
   │      Observability       │
   │  ┌──────┐ ┌────────────┐ │
   │  │Jaeger│ │ Schema     │ │
   │  │Trace │ │ Registry   │ │
   │  └──────┘ │ (Avro)     │ │
   │           └────────────┘ │
   └──────────────────────────┘
```

## System Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| Frontend | User interface | Next.js, TypeScript, Tailwind |
| Order Service (API Gateway) | CRUD orders, auth, rate limit, outbox | Node.js, Express, PostgreSQL, Redis |
| Inventory Service | Stock management, reservation | Node.js, PostgreSQL, Redis |
| Payment Service | Payment processing, transaction store | Node.js, PostgreSQL |
| Notification Service | Email/SMS/Push | Node.js |
| Analytics Service | Metrics & reporting | Node.js, PostgreSQL |
| Audit Service | Event history | Node.js, PostgreSQL |
| DLQ Replay Service | View/replay failed events | Node.js, PostgreSQL |
| Kafka | Event bus | Confluent Kafka 7.6 |
| PostgreSQL | Persistence | PostgreSQL 16 |
| Redis | Cache, rate limiting, sliding window | Redis 7 |
| Schema Registry | Avro event contracts, versioning | Confluent Schema Registry |
| Jaeger | Distributed tracing | Jaeger all-in-one |

## Event Flow: Complete Order Lifecycle

```
Order Created  ──►  Inventory Reserved  ──►  Payment Processed  ──►  Shipping
     │                      │                       │
     ▼                      ▼                       ▼
  Cancel Order         Inventory Failed         Payment Failed
     │                      │                       │
     ▼                      ▼                       ▼
  Inventory Release    Order Cancelled          Inventory Release
```

### Topics & Event Types

| Topic | Producer | Consumers | Schema Version |
|-------|----------|-----------|----------------|
| `order-created` | Order Service | Inventory, Notification, Analytics, Audit | `order-created-v1` |
| `order-cancelled` | Order Service | Inventory (release), Notification, Audit | `order-cancelled-v1` |
| `inventory-reserved` | Inventory Service | Payment, Notification, Audit | `inventory-reserved-v1` |
| `inventory-failed` | Inventory Service | Notification, Audit | `inventory-failed-v1` |
| `inventory-release` | Payment/Order | Inventory Service | `inventory-release-v1` |
| `payment-processed` | Payment Service | Notification, Analytics, Audit | `payment-processed-v1` |
| `payment-failed` | Payment Service | Notification, Audit | `payment-failed-v1` |
| `dlq-events` | All services | DLQ Replay Service | — |

## Exactly-Once Processing

### Kafka Guarantees
- **At-Least-Once**: Kafka guarantees each message is delivered at least once. Duplicates can occur during producer retries or consumer rebalances.

### Application-Level Guarantees
- **Effectively-Once**: Achieved through the combination of:
  1. **Transactional Outbox Pattern**: Order + event written atomically in same DB transaction
  2. **Consumer Idempotency**: Each consumer maintains a `processed_events` table. Duplicate events are detected via `event_id` (PK) and silently skipped.
  3. **Idempotent Producers**: Kafka producer `enable.idempotence=true` prevents duplicate publishes within producer sessions.

### Why Not Kafka Exactly-Once?
Kafka's exactly-once semantics (`isolation.level=read_committed`, transactions) add significant complexity (transaction coordinators, zombie fencing) and performance overhead. The outbox + idempotency approach is simpler, portable across message brokers, and sufficient for order management requirements.

## Observability

### Distributed Tracing (OpenTelemetry + Jaeger)
- Every API request generates a trace ID that propagates across all services
- Each Kafka message carries the parent trace context in headers
- View complete request flow: Frontend → Order Service → Kafka → Inventory → Payment
- Jaeger UI available at `http://localhost:16686`

### Metrics (Prometheus + Grafana)
- Kafka consumer lag per consumer group
- DLQ event count and replay rate
- Order throughput (orders/sec)
- Payment success/failure ratio
- Service health and request latency

## Reliability Patterns

| Pattern | Mechanism | Location |
|---------|-----------|----------|
| Transactional Outbox | DB transaction + poller | Order Service |
| Consumer Idempotency | `processed_events` table | All consumers |
| Dead Letter Queue | `dlq-events` topic | All services |
| Exponential Backoff Retry | `retry` config per consumer | All consumers |
| Circuit Breaker | Retry budget, max retries | Consumer config |
| Bulkhead | Per-service DB connection pool | All services |
