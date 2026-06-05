# Observability

## Distributed Tracing (OpenTelemetry + Jaeger)

Every API request generates a unique **trace ID** that propagates across all services and Kafka messages.

### Trace Flow

```
Frontend (HTTP)        Order Service (HTTP/Kafka)     Payment Service (Consumer)
    │                         │                              │
    │  POST /api/orders       │                              │
    ├────────────────────────►│                              │
    │                         │  Kafka: inventory-reserved   │
    │                         ├─────────────────────────────►│
    │                         │                              │  Process payment
    │                         │                              ├─── ...
    │                         │  Kafka: payment-processed    │
    │                         │◄─────────────────────────────┤
    │  Order Status           │                              │
    │◄────────────────────────┤                              │
```

One trace ID connects all spans across HTTP requests, Kafka produce/consume, and database queries.

### Jaeger UI

- **URL**: `http://localhost:16686`
- **Service Search**: Filter by `order-service`, `payment-service`, etc.
- **Trace Search**: Search by trace ID, tags, time range
- **Span Details**: View latency breakdown per operation

### Enabling Tracing

Set the environment variable to enable OpenTelemetry:

```bash
OTEL_ENABLED=true JAEGER_ENDPOINT=http://jaeger:14250 npm run dev
```

In Docker Compose, tracing is enabled by default for `payment-service` and can be enabled for other services.

## Metrics (Prometheus + Grafana)

Each service exposes a `/metrics` endpoint (or `/health` for basic status). Key metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `orders_created_total` | Counter | Total orders created |
| `orders_cancelled_total` | Counter | Total orders cancelled |
| `payment_success_total` | Counter | Successful payments |
| `payment_failed_total` | Counter | Failed payments |
| `kafka_messages_produced_total` | Counter | Messages published |
| `kafka_consumer_lag` | Gauge | Consumer lag per group |
| `dlq_messages_total` | Counter | Messages sent to DLQ |
| `http_request_duration_ms` | Histogram | API latency |

## Schema Registry

- **URL**: `http://localhost:8081`
- **Subjects**: `order-created-value`, `inventory-reserved-value`, `payment-processed-value`, `payment-failed-value`
- **Compatibility**: `BACKWARD` — new schemas can read data written with old schemas

### Managing Schemas

```bash
# List subjects
curl http://localhost:8081/subjects

# Get latest schema version
curl http://localhost:8081/subjects/order-created-value/versions/latest

# Register new schema version
curl -X POST http://localhost:8081/subjects/order-created-value/versions \
  -H "Content-Type: application/json" \
  -d '{"schema": "{\"type\":\"record\",...}"}'
```

## Grafana Dashboards

Recommended dashboards:

1. **Order System Overview** — orders/sec, payment success rate, Kafka lag
2. **DLQ Monitor** — DLQ count by error type, replay rate
3. **Service Health** — CPU, memory, request latency per service
4. **Kafka Performance** — Partition leaders, bytes in/out, consumer offsets
