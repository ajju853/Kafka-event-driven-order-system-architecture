<div align="center">

<img src="https://capsule-render.vercel.app/api?type=venom&color=gradient&customColorList=0,2,2,5,30&height=220&section=header&text=Kafka%20Order%20System&fontSize=48&fontColor=fff&animation=fadeIn&fontAlignY=40&desc=Production-Grade%20Event-Driven%20Microservices%20Architecture&descAlignY=62&descAlign=50&descSize=16" width="100%"/>

</div>

<div align="center">

```
┌─────────────────────────────────────────────────────────────────────────┐
│   7 Microservices  ·  8 Kafka Topics  ·  Kubernetes + HPA  ·  Zero Data Loss  │
└─────────────────────────────────────────────────────────────────────────┘
```

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-7.6-231F20?style=flat-square&logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-HPA-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Jaeger-000000?style=flat-square&logo=opentelemetry&logoColor=white)](https://opentelemetry.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=flat-square)](LICENSE)

<br/>

> **"The patterns that power Uber's payment system, Netflix's content pipeline, and Shopify's order processing — implemented from scratch."**

<br/>

[**🚀 Quick Start**](#-quick-start) · [**🏗️ Architecture**](#️-architecture) · [**⚡ Event Flow**](#-event-flow) · [**🛡️ Reliability**](#️-reliability-patterns) · [**🔬 Observability**](#-observability) · [**☸️ Kubernetes**](#️-kubernetes-deployment)

</div>

---

## The Problem This Solves

Modern platforms coordinating **orders → inventory → payments → notifications → analytics → audit** face three hard problems in production:

| Problem | Naive Approach | This System |
|---------|---------------|-------------|
| **Dual-write** | Write to DB + Kafka separately | Transactional Outbox — atomic, zero loss |
| **Cascading failures** | Sync HTTP between services | Async Kafka — services never wait on each other |
| **Bad message loops** | Retry forever | 3× exponential backoff → DLQ → human replay |

This is not a tutorial project. Every architecture decision here maps to a documented failure mode that has taken down real systems in production.

---

## 🏗️ Architecture

```
                            ┌──────────────────────────────────┐
                            │        FRONTEND LAYER            │
                            │   Next.js 14  ·  port 3000       │
                            │   Redux Toolkit · TanStack Query │
                            └──────────────┬───────────────────┘
                                           │ REST / HTTPS
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          ORDER SERVICE  ·  port 4001                     │
│                         (API Gateway + Event Producer)                   │
│                                                                          │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│   │  JWT Auth   │   │ Rate Limiter │   │  Transactional Outbox    │    │
│   │  Bearer     │   │ Redis SW     │   │  ┌──────────┐ ┌────────┐ │    │
│   │  Validation │   │ 100 req/min  │   │  │ Order DB │→│ Outbox │ │    │
│   └─────────────┘   └──────────────┘   │  │  (same   │ │ Writer │ │    │
│                                         │  │   tx)    │ │        │ │    │
│                                         │  └──────────┘ └───┬────┘ │    │
│                                         │              ┌────▼────┐  │    │
│                                         │              │ Outbox  │  │    │
│                                         │              │ Poller  │  │    │
│                                         └──────────────┴────┬────┘──┘    │
└──────────────────────────────────────────────────┬──────────┘            │
                                                   │ Produce Events        │
                                                   ▼                      │
        ╔═════════════════════════════════════════════════════════════════╗│
        ║              APACHE KAFKA  ·  8 TOPICS  ·  3 PARTITIONS        ║│
        ║                                                                 ║▼
        ║  order-created  │  inventory-reserved  │  payment-processed    ║
        ║  order-cancelled│  inventory-failed    │  payment-failed       ║
        ║  inventory-release                     │  dlq-events (30d)     ║
        ╚══════════╤═══════════════╤═════════════╤════════════════════════╝
                   │               │             │
       ┌───────────┘    ┌──────────┘    ┌────────┘
       ▼                ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  INVENTORY  │  │   PAYMENT   │  │NOTIFICATION │  │  ANALYTICS  │
│  port 4002  │  │  port 4006  │  │  port 4003  │  │  port 4004  │
│             │  │             │  │             │  │             │
│ PostgreSQL  │  │ PostgreSQL  │  │ Email/SMS   │  │ PostgreSQL  │
│ Redis Cache │  │ 90% success │  │ Push notify │  │ Daily stats │
│ Reservations│  │ Simulated   │  │             │  │ Revenue KPIs│
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
       ▼                                                     ▼
┌─────────────┐                                    ┌─────────────┐
│    AUDIT    │                                    │ DLQ REPLAY  │
│  port 4005  │                                    │  port 4007  │
│             │                                    │             │
│ PostgreSQL  │                                    │ PostgreSQL  │
│ Immutable   │                                    │ View/Replay │
│ Event log   │                                    │ Failed msgs │
└─────────────┘                                    └─────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY                             │
│  Jaeger:16686  ·  Kafka UI:8080  ·  Prometheus:9090  ·  Grafana  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Services

| # | Service | Port | Responsibilities |
|---|---------|------|-----------------|
| 1 | **Order Service** | `4001` | API gateway · JWT auth · rate limiting · Transactional Outbox · Kafka producer |
| 2 | **Inventory Service** | `4002` | Stock reservations · Redis cache · release on rollback |
| 3 | **Payment Service** | `4006` | Payment processing · 90% success simulation · publishes failure events |
| 4 | **Notification Service** | `4003` | Email / SMS / Push on every state change |
| 5 | **Analytics Service** | `4004` | Daily revenue metrics · order KPIs · success rates |
| 6 | **Audit Service** | `4005` | Immutable event log · query by order or event type |
| 7 | **DLQ Replay Service** | `4007` | Capture failed events · REST API to view and replay |

### Infrastructure

| Component | Version | Role |
|-----------|---------|------|
| Apache Kafka | 7.6 (Confluent) | Event bus · 3 partitions/topic |
| PostgreSQL | 16 | Per-service isolation (6 databases) |
| Redis | 7 | Caching + sliding-window rate limiter |
| Schema Registry | 7.6 | Avro versioning · backward compatibility |
| Jaeger | 1.55 | Distributed tracing across all 7 services |
| Prometheus + Grafana | Latest | 18 custom metrics · pre-built dashboard |

---

## ⚡ Event Flow

### Happy Path — Complete Order Lifecycle

```
Frontend → Order Service
              │
              ├─ [1] Write order + outbox event (single DB transaction)
              │
              ▼
         ── Kafka: order-created ──►  Inventory Service
                                           │
                                           ├─ [2] Reserve stock (Redis + PG)
                                           │
                                           ▼
                                  ── Kafka: inventory-reserved ──► Payment Service
                                                                         │
                                                                         ├─ [3] Process payment
                                                                         │
                                                                         ▼
                                                              ── Kafka: payment-processed ──►
                                                                    Notification ✓
                                                                    Analytics ✓
                                                                    Audit ✓
                                                                    Order (update status) ✓
```

### Failure Path — Payment Fails → Auto-Rollback

```
Payment Service  →  payment FAILED (10% of requests)
      │
      ├─ publish: payment-failed  ──►  Notification (customer email)
      │                           ──►  Audit (failure record)
      │
      └─ publish: inventory-release  ──►  Inventory Service
                                              │
                                              └─ release reserved stock automatically
                                                 ← no manual intervention needed
```

### DLQ Recovery Flow

```
Any Service  →  event processing fails after 3 retries (5s → 15s → 45s)
      │
      └─ publish: dlq-events  ──►  DLQ Replay Service (stores in PostgreSQL)
                                        │
                                        ▼
                               Operator: GET /dlq/events
                                        │  (investigate root cause)
                                        ▼
                               Operator: POST /dlq/replay/{eventId}
                                        │
                                        └─ re-publish to original topic ──► re-process ✓
```

### Kafka Topics

| Topic | Partitions | Retention | Producers | Consumers |
|-------|-----------|-----------|-----------|-----------|
| `order-created` | 3 | 7 days | Order | Inventory, Notification, Analytics, Audit |
| `order-cancelled` | 3 | 7 days | Order | Inventory (release), Notification, Audit |
| `inventory-reserved` | 3 | 7 days | Inventory | Payment, Notification, Analytics, Audit |
| `inventory-failed` | 3 | 7 days | Inventory | Notification, Audit |
| `inventory-release` | 3 | 7 days | Payment, Order | Inventory |
| `payment-processed` | 3 | 7 days | Payment | Notification, Analytics, Audit, Order |
| `payment-failed` | 3 | 7 days | Payment | Notification, Audit, Inventory |
| `dlq-events` | 1 | **30 days** | All services | DLQ Replay |

---

## 🛡️ Reliability Patterns

Every pattern here solves a documented production failure mode:

### Transactional Outbox Pattern

```
❌ Naive approach:
   db.save(order)          ← succeeds
   kafka.publish(event)    ← crashes → event LOST FOREVER

✅ This system:
   BEGIN TRANSACTION
     db.save(order)
     db.save(outbox_event)  ← same transaction
   COMMIT
   → Outbox poller publishes to Kafka (FOR UPDATE SKIP LOCKED)
   → Zero dual-write risk. Zero lost events.
```

### Consumer Idempotency (Effectively-Once)

```
Kafka guarantees:   At-Least-Once delivery
Producer:           Idempotent (enable.idempotence=true)
Consumer:           processed_events table (PK = event_id)
                    → duplicate detected → silently skipped

Result:  Effectively-Once application semantics
         without Kafka's expensive transaction overhead
```

### Saga Pattern (Distributed Rollback)

```
Payment FAILS
    │
    ├─ publish payment-failed
    └─ publish inventory-release  ←  compensating transaction
                                       Inventory Service consumes →
                                       releases reserved stock
                                       ← no 2PC, no distributed lock
```

### Full Reliability Matrix

| Pattern | Problem Solved | Implementation |
|---------|---------------|----------------|
| **Transactional Outbox** | Dual-write / lost events | `outbox_events` table + `FOR UPDATE SKIP LOCKED` poller |
| **Consumer Idempotency** | Duplicate processing | `processed_events` PK constraint on `event_id` |
| **Dead Letter Queue** | Poison pill messages | `dlq-events` topic → DLQ Replay Service REST API |
| **Exponential Backoff** | Thundering herd on failure | `5s → 15s → 45s`, max 3 retries, then DLQ |
| **Saga Pattern** | Distributed consistency | Compensating events on payment/inventory failure |
| **Bulkhead** | Connection pool exhaustion | Per-service PostgreSQL pool (max 10–20 connections) |
| **Idempotent Producer** | Duplicate Kafka messages | `enable.idempotence=true` on all producers |
| **Rate Limiting** | API abuse | Redis sliding window · 100 req/min/IP · graceful degradation |

---

## 🔬 Observability

### Distributed Tracing (OpenTelemetry + Jaeger)

Every request — from frontend click to final database write — carries a single trace ID across all 7 services:

```
POST /api/orders
     │   trace: abc123
     ▼
Order Service [Span 1: HTTP handler, 12ms]
     │   trace: abc123 → propagated in Kafka message header
     ▼
Inventory Service [Span 2: Kafka consumer, 8ms]
     │   trace: abc123
     ▼
Payment Service [Span 3: Payment processing, 45ms]
     │   trace: abc123
     ▼
Jaeger UI: full waterfall across 7 services, 1 trace ID
```

View at: **http://localhost:16686** — filter by service, drill into spans, see exact SQL queries.

### Prometheus Metrics (18 custom metrics)

Every service exposes `/metrics`. Prometheus scrapes every 15s.

| Category | Key Metrics |
|----------|------------|
| **Orders** | `orders_created_total`, `orders_cancelled_total`, `processing_duration_seconds` (p50/p95/p99) |
| **Payments** | `payments_processed_total`, `payments_failed_total`, `payment_duration_seconds` |
| **Inventory** | `stock_reserved_total`, `stock_released_total`, `reservation_failures_total` |
| **DLQ** | `dlq_events_stored_total`, `dlq_events_replayed_total`, `dlq_replay_failures_total` |
| **Infrastructure** | `rate_limit_hits_total`, `outbox_published_total`, `notifications_sent_total` |

### Pre-built Grafana Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Orders Created (24h)  │  Payment Success Rate  │  DLQ Count   │
│  [time series]          │  [gauge: 92.3%]        │  [stat: 3]   │
├─────────────────────────────────────────────────────────────────┤
│  Processing Latency p50/p95/p99   │  Payment Duration Histogram │
│  [line chart]                      │  [heatmap]                  │
├─────────────────────────────────────────────────────────────────┤
│  Rate Limit Hits/hour  │  Stock Operations  │  Audit Event Rate  │
└─────────────────────────────────────────────────────────────────┘
```

Import: `monitoring/grafana/dashboards/kafka-orders-system.json` → Grafana UI

### Schema Registry (Avro · Backward Compatible)

```avro
// order-created-v1 → v2: safe schema evolution
{
  "name": "couponCode",
  "type": ["null", "string"],
  "default": null   // ← backward compatible: v1 readers ignore new field
}
```

---

## 🔒 Security

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| **API Auth** | JWT Bearer | Validated on every route via `auth.ts` middleware |
| **Rate Limiting** | Redis sliding window | 100 req/min/IP · X-RateLimit-* headers · fails open if Redis down |
| **Input Validation** | Zod schemas | All API bodies validated before processing |
| **HTTP Security** | Helmet.js | Full header suite: CSP, HSTS, X-Frame-Options |
| **SQL Injection** | Parameterized queries | `$1, $2` placeholders throughout — no string concatenation |
| **Secrets** | Kubernetes Secrets | DB passwords, API keys — never in environment variables |
| **TLS** | HTTPS via Ingress | TLS termination at Kubernetes Ingress |
| **CORS** | Configurable origins | Per-environment allow-list |

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20+
- Docker + Docker Compose
- `kubectl` (for Kubernetes deployment)

### Run Everything in 30 Seconds

```bash
git clone https://github.com/ajju853/Kafka-event-driven-order-system-architecture.git
cd kafka-event-driven-order-system-architecture

# Start all 18 containers: Kafka, PostgreSQL, Redis, 7 services, frontend, Jaeger, Prometheus, Grafana
docker compose -f kafka-order-system/docker/docker-compose.yml up -d

# Verify all services are healthy
docker compose -f kafka-order-system/docker/docker-compose.yml ps
```

### Access Points

| Service | URL | Auth |
|---------|-----|------|
| **Frontend** | http://localhost:3000 | — |
| **Order API** | http://localhost:4001 | `Bearer pk_test_order_system_2024` |
| **Kafka UI** | http://localhost:8080 | — |
| **Jaeger Tracing** | http://localhost:16686 | — |
| **Prometheus** | http://localhost:9090 | — |
| **Grafana** | http://localhost:3001 | `admin / admin` |
| **Schema Registry** | http://localhost:8081 | — |
| **DLQ Replay API** | http://localhost:4007/dlq/events | — |

### Test the Full Order Flow

```bash
# 1. Place an order — triggers the full pipeline automatically
curl -X POST http://localhost:4001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pk_test_order_system_2024" \
  -d '{
    "customerId": "550e8400-e29b-41d4-a716-446655440001",
    "items": [
      { "productId": "550e8400-e29b-41d4-a716-446655440010", "quantity": 2, "price": 29.99 }
    ],
    "shippingAddress": {
      "street": "123 Main St", "city": "San Francisco",
      "state": "CA", "zip": "94105", "country": "US"
    }
  }'

# 2. List your orders
curl http://localhost:4001/api/orders \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 3. Cancel an order
curl -X POST http://localhost:4001/api/orders/{ORDER_ID}/cancel \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 4. View failed events in the DLQ
curl http://localhost:4007/dlq/events

# 5. Replay a specific failed event
curl -X POST http://localhost:4007/dlq/replay/{EVENT_ID}

# 6. View payment history
curl http://localhost:4006/payments

# 7. Open Jaeger — see the full distributed trace for your order
open http://localhost:16686
```

---

## 🧪 Development

### Local Setup Without Docker

```bash
# 1. Clone and install all workspaces
git clone https://github.com/ajju853/Kafka-event-driven-order-system-architecture.git
cd kafka-event-driven-order-system-architecture && npm install

# 2. Start only infrastructure (Kafka, PG, Redis, Jaeger)
docker compose -f kafka-order-system/docker/docker-compose.yml up -d \
  zookeeper kafka postgres redis schema-registry jaeger

# 3. Start all 7 services concurrently
npm run dev

# 4. Start the frontend (separate terminal)
npm run dev:frontend
```

### Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start all 7 services concurrently with hot reload |
| `npm run dev:frontend` | Start Next.js frontend on port 3000 |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all tests |
| `npm run docker:up` | Full stack in Docker (18 containers) |
| `npm run docker:down` | Stop and clean up |

---

## ☸️ Kubernetes Deployment

```bash
cd kafka-event-driven-order-system-architecture/kafka-order-system

# Deploy in order
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/kafka.yaml
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/services.yaml
kubectl apply -f kubernetes/hpa.yaml
kubectl apply -f kubernetes/ingress.yaml

# Verify
kubectl get pods -n order-system
kubectl rollout status deployment/order-service -n order-system
```

### Auto-Scaling (HPA)

| Service | Min | Max | CPU Target |
|---------|-----|-----|------------|
| Order Service | 2 | 10 | 70% |
| Inventory Service | 2 | 8 | 70% |
| Payment Service | 2 | 6 | 70% |
| Frontend | 2 | 6 | 70% |
| Notification, Analytics, Audit | 1 | 4 | 70% |
| DLQ Replay | 1 | 3 | 70% |

### CI/CD Pipeline (GitHub Actions)

```
Push to main
     │
     ▼
[Test all services]  →  [Build Docker images]  →  [Push to Registry]  →  [Deploy to K8s]  →  [Rollout status]
```

---

## 📁 Project Structure

```
kafka-event-driven-order-system-architecture/
│
├── kafka-order-system/
│   ├── shared/                         # Shared Kafka event schemas (Zod) + TypeScript types
│   │
│   ├── services/
│   │   ├── order-service/              # API Gateway + Transactional Outbox  (port 4001)
│   │   ├── inventory-service/          # Stock management + Redis cache       (port 4002)
│   │   ├── payment-service/            # Payment processing + saga events     (port 4006)
│   │   ├── notification-service/       # Email / SMS / Push dispatch          (port 4003)
│   │   ├── analytics-service/          # Revenue metrics + daily summaries    (port 4004)
│   │   ├── audit-service/              # Immutable event log                  (port 4005)
│   │   └── dlq-replay-service/         # DLQ capture + REST replay API        (port 4007)
│   │
│   ├── frontend/                       # Next.js 14 — App Router + Redux + TanStack Query
│   │
│   ├── monitoring/
│   │   ├── prometheus/prometheus.yml   # Scrape config — all 7 services
│   │   └── grafana/dashboards/         # Pre-built JSON dashboard
│   │
│   ├── docker/docker-compose.yml       # Full 18-container local stack
│   ├── kubernetes/                     # Deployments, HPA, Ingress, Secrets
│   ├── docs/                           # HLD, API, Kafka, Outbox, DLQ, Security, Observability
│   └── .github/workflows/ci-cd.yml    # Test → Build → Push → Deploy
```

---

## 📖 Documentation

| Document | Contents |
|----------|----------|
| [`docs/HLD.md`](kafka-order-system/docs/HLD.md) | Full architecture, component design, data flow, event lifecycle |
| [`docs/Kafka.md`](kafka-order-system/docs/Kafka.md) | Topic design, consumer groups, Avro schemas, exactly-once semantics |
| [`docs/API.md`](kafka-order-system/docs/API.md) | All REST endpoints with request/response examples |
| [`docs/Outbox.md`](kafka-order-system/docs/Outbox.md) | Transactional Outbox implementation with SQL queries |
| [`docs/Retry.md`](kafka-order-system/docs/Retry.md) | Backoff algorithm, configuration, circuit breaking |
| [`docs/DLQ.md`](kafka-order-system/docs/DLQ.md) | DLQ capture, replay API, operator recovery workflow |
| [`docs/Security.md`](kafka-order-system/docs/Security.md) | JWT, RBAC, rate limiting, SQL injection prevention |
| [`docs/Observability.md`](kafka-order-system/docs/Observability.md) | OpenTelemetry, Jaeger, Schema Registry, Prometheus |

---

## 🧠 Why Each Decision Was Made

| Decision | Alternative Considered | Why This Approach |
|----------|----------------------|------------------|
| Transactional Outbox | Direct Kafka producer call | Direct call → dual-write risk. Outbox is atomic, proven at scale. |
| Per-service PostgreSQL | Shared database | Shared DB = tight coupling, schema conflicts, no independent scaling |
| Idempotent consumers | Kafka Exactly-Once Transactions | Kafka EOS adds complexity + performance overhead. Outbox + idempotency is simpler and portable. |
| Exponential backoff → DLQ | Infinite retry | Infinite retry blocks consumers and masks root cause. DLQ surfaces failures for human review. |
| Saga (compensating events) | Two-Phase Commit (2PC) | 2PC is fragile, slow, and locks resources. Sagas are async, resilient, and proven in production. |
| Schema Registry (Avro) | JSON schemas | Avro enforces schema evolution contracts. JSON has no enforcement — a producer change can silently break all consumers. |

---

## 🤝 Contributing

Contributions welcome. This project is designed as both a portfolio piece and a learning resource.

```bash
git checkout -b feature/your-feature
git commit -m 'Add: your feature description'
git push origin feature/your-feature
# Open a Pull Request
```

**High-value contribution ideas:**
- End-to-end tests with Testcontainers
- gRPC for synchronous internal paths
- Prometheus alerting rules (consumer lag, DLQ growth rate, payment failure spike)
- Half-open circuit breaker state machine

---

## 📄 License

MIT License — see [`LICENSE`](LICENSE) for details.

---

<div align="center">

Built by [**@ajju853**](https://github.com/ajju853) · [Portfolio](https://ajimpatelportfolio.ajimp340.workers.dev/) · [LinkedIn](https://www.linkedin.com/in/ajim-patel-b359192ab/)

<br/>

**⭐ Star this repo if it helped you understand event-driven architecture ⭐**

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,2,5,30&height=100&section=footer" width="100%"/>

</div>
