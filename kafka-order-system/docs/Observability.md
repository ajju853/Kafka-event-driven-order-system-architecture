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

Every service exposes a `/metrics` endpoint scraped by Prometheus. The shared prom-client registry also collects default process metrics (CPU, memory, event loop lag).

### Architecture

```
Prometheus (scrape /metrics every 15s)
  ├── order-service:4001/metrics
  ├── inventory-service:4002/metrics
  ├── notification-service:4003/metrics
  ├── analytics-service:4004/metrics
  ├── audit-service:4005/metrics
  ├── payment-service:4006/metrics
  └── dlq-replay-service:4007/metrics
       │
       ▼
Grafana (http://localhost:3001)
  └── Pre-provisioned dashboard: "Kafka Order System"
```

### Metric Reference

| Metric | Type | Labels | Service |
|--------|------|--------|---------|
| `kafka_orders_created_total` | Counter | — | order-service |
| `kafka_orders_cancelled_total` | Counter | — | order-service |
| `kafka_orders_outbox_published_total` | Counter | — | order-service |
| `kafka_orders_rate_limit_hits_total` | Counter | — | order-service |
| `kafka_orders_processing_duration_seconds` | Histogram | — | order-service |
| `kafka_orders_stock_reserved_total` | Counter | — | inventory-service |
| `kafka_orders_stock_released_total` | Counter | — | inventory-service |
| `kafka_orders_stock_reservation_failures_total` | Counter | — | inventory-service |
| `kafka_orders_inventory_checks_total` | Counter | — | inventory-service |
| `kafka_orders_notifications_sent_total` | Counter | — | notification-service |
| `kafka_orders_analytics_events_total` | Counter | — | analytics-service |
| `kafka_orders_audit_events_total` | Counter | — | audit-service |
| `kafka_orders_payments_processed_total` | Counter | — | payment-service |
| `kafka_orders_payments_failed_total` | Counter | — | payment-service |
| `kafka_orders_payment_duration_seconds` | Histogram | — | payment-service |
| `kafka_orders_dlq_events_stored_total` | Counter | — | dlq-replay-service |
| `kafka_orders_dlq_events_replayed_total` | Counter | — | dlq-replay-service |
| `kafka_orders_dlq_replay_failures_total` | Counter | — | dlq-replay-service |
| `process_resident_memory_bytes` | Gauge | service | all (default) |
| `process_cpu_seconds_total` | Counter | service | all (default) |

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

## Grafana Dashboard

A pre-provisioned dashboard (`monitoring/grafana/dashboards/kafka-orders-system.json`) is automatically loaded when Grafana starts. It includes:

| Panel | Metrics |
|-------|---------|
| Orders Created / sec | `rate(kafka_orders_created_total[1m])` |
| Payment Success vs Failure | `rate(kafka_orders_payments_processed_total[1m])`, `rate(kafka_orders_payments_failed_total[1m])` |
| Payment Duration (p50/p95/p99) | `histogram_quantile(..., kafka_orders_payment_duration_seconds_bucket)` |
| Inventory Stock Reserved / sec | `rate(kafka_orders_stock_*_total[1m])` |
| DLQ Events | `kafka_orders_dlq_events_stored_total`, `rate(kafka_orders_dlq_events_replayed_total[5m])` |
| Notifications Sent / sec | `rate(kafka_orders_notifications_sent_total[1m])` |
| HTTP Requests / sec | `rate(http_requests_total[1m])` |
| Audit Events / sec | `rate(kafka_orders_audit_events_total[1m])` |
| Rate Limit Hits / sec | `rate(kafka_orders_rate_limit_hits_total[1m])` |
| Outbox Published / sec | `rate(kafka_orders_outbox_published_total[1m])` |
| Memory Usage (per service) | `process_resident_memory_bytes` |

Access Grafana at `http://localhost:3001` (default credentials: `admin/admin`).
