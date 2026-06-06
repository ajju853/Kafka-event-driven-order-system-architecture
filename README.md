<div align="center">

<h1>⚡ Kafka Order System</h1>
<h3>Production-Grade Event-Driven Microservices Architecture</h3>

<p>
<strong>7 Microservices</strong> &nbsp;·&nbsp;
<strong>8 Kafka Topics</strong> &nbsp;·&nbsp;
<strong>Kubernetes + HPA</strong> &nbsp;·&nbsp;
<strong>Zero Data Loss</strong>
</p>

</div>

**7 Microservices · 8 Kafka Topics · Kubernetes + HPA · Zero Data Loss**

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-7.6-231F20?style=flat-square&logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-HPA-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Jaeger-000000?style=flat-square&logo=opentelemetry&logoColor=white)](https://opentelemetry.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=flat-square)](LICENSE)

<br/>

[**Quick Start**](#-quick-start) · [**Architecture**](#️-architecture) · [**Event Flow**](#-event-flow) · [**Reliability**](#️-reliability-patterns) · [**Observability**](#-observability) · [**Kubernetes**](#️-kubernetes-deployment) · [**Docs**](#-documentation)

</div>

---

## Overview

A production-grade, event-driven order processing system built on Apache Kafka. Every architecture decision maps directly to patterns used at Uber, Netflix, and Shopify — and every one solves a documented production failure mode.

The system coordinates the full order lifecycle — **creation → inventory reservation → payment → notifications → analytics → audit** — across 7 isolated microservices, connected exclusively through Kafka events. No service calls another directly.

### Why This Architecture Exists

Synchronous, HTTP-coupled order systems fail in three predictable ways in production:

| Failure Mode | Naive Approach | This System |
|---|---|---|
| **Dual-write inconsistency** | Write to DB, then Kafka — one can fail | Transactional Outbox: both in a single DB transaction |
| **Cascading service failures** | Service A waits on Service B's HTTP response | Async Kafka messaging — services never block on each other |
| **Unrecoverable poison messages** | Retry indefinitely, block the consumer | 3× exponential backoff → Dead Letter Queue → operator replay |

---

## 🏗️ Architecture

```
                         ┌────────────────────────────────┐
                         │         FRONTEND LAYER         │
                         │    Next.js 14  ·  port 3000    │
                         │  Redux Toolkit · TanStack Query│
                         └───────────────┬────────────────┘
                                         │ HTTPS / REST
                                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                   ORDER SERVICE  ·  port 4001                      │
│               API Gateway + Transactional Outbox Producer          │
│                                                                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  JWT Auth  │  │ Rate Limiter │  │  Transactional Outbox    │  │
│  │  Bearer    │  │ Redis · 100  │  │                          │  │
│  │  Tokens    │  │ req/min/IP   │  │  orders ──┐              │  │
│  └────────────┘  └──────────────┘  │  outbox ◄─┘  (1 tx)    │  │
│                                    │       │                  │  │
│                                    │  Poller (SKIP LOCKED)   │  │
│                                    └──────────┬───────────────┘  │
└───────────────────────────────────────────────┼────────────────────┘
                                                │ Produce
                                                ▼
   ╔══════════════════════════════════════════════════════════════╗
   ║          APACHE KAFKA  ·  8 TOPICS  ·  3 PARTITIONS         ║
   ║                                                              ║
   ║  order-created     │  inventory-reserved  │  payment-processed  ║
   ║  order-cancelled   │  inventory-failed    │  payment-failed     ║
   ║  inventory-release │  dlq-events (30d retention)               ║
   ╚══════════╤═════════════════╤══════════════╤═══════════════════╝
              │                 │              │
    ┌─────────┘     ┌───────────┘    ┌─────────┘
    ▼               ▼                ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│INVENTORY │  │ PAYMENT  │  │NOTIFICA- │  │ANALYTICS │
│port 4002 │  │port 4006 │  │TION 4003 │  │port 4004 │
│          │  │          │  │          │  │          │
│PG + Redis│  │PG · 90%  │  │Email/SMS │  │PG · KPIs │
│Reserves  │  │simulated │  │Push      │  │Revenue   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
    ▼                                           ▼
┌──────────┐                           ┌──────────────┐
│  AUDIT   │                           │  DLQ REPLAY  │
│port 4005 │                           │  port 4007   │
│          │                           │              │
│PG · immu-│                           │PG · REST API │
│table log │                           │view + replay │
└──────────┘                           └──────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY LAYER                          │
│  Jaeger :16686  ·  Kafka UI :8080  ·  Prometheus :9090  ·  Grafana │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Services

| # | Service | Port | Role |
|---|---------|------|------|
| 1 | **Order Service** | `4001` | REST API entry point. JWT auth, rate limiting, Transactional Outbox, Kafka producer |
| 2 | **Inventory Service** | `4002` | Stock reservation and release. Redis cache + PostgreSQL. Listens for saga rollback events |
| 3 | **Payment Service** | `4006` | Payment processing with 90% success simulation. Publishes success and failure events |
| 4 | **Notification Service** | `4003` | Email, SMS, and push dispatch on every order state transition |
| 5 | **Analytics Service** | `4004` | Revenue aggregation, order KPIs, daily summaries |
| 6 | **Audit Service** | `4005` | Append-only, immutable event log. Queryable by order ID or event type |
| 7 | **DLQ Replay Service** | `4007` | Captures events that exhausted retries. REST API for operator investigation and replay |

### Infrastructure

| Component | Version | Role |
|---|---|---|
| Apache Kafka | 7.6 (Confluent) | Event bus — 3 partitions per topic |
| PostgreSQL | 16 | Per-service database isolation (6 independent databases) |
| Redis | 7 | Inventory cache + sliding-window rate limiter |
| Schema Registry | 7.6 | Avro schema versioning with backward compatibility enforcement |
| Jaeger | 1.55 | Distributed tracing — single trace ID across all 7 services |
| Prometheus + Grafana | Latest | 18 custom metrics with pre-built dashboard |

---

## ⚡ Event Flow

### Happy Path

```
Client → POST /api/orders
              │
              ├─ [1] Atomic write: orders table + outbox_events (single transaction)
              │       Outbox poller publishes to Kafka
              │
              ▼
         order-created ──────────────────────► Inventory Service
                                                      │
                                                      ├─ [2] Reserve stock (Redis + PG)
                                                      │
                                                      ▼
                                             inventory-reserved ──► Payment Service
                                                                           │
                                                                           ├─ [3] Process payment
                                                                           │
                                                                           ▼
                                                                  payment-processed ──►
                                                                       Notification ✓
                                                                       Analytics    ✓
                                                                       Audit        ✓
                                                                       Order status ✓
```

### Failure Path — Automatic Rollback via Saga

```
Payment Service  →  payment fails (10% of requests, simulated)
      │
      ├─ publish: payment-failed     ──► Notification Service (customer alert)
      │                               ──► Audit Service (failure record)
      │
      └─ publish: inventory-release  ──► Inventory Service
                                               │
                                               └─ releases reserved stock automatically
                                                  ← no manual intervention, no 2PC
```

### DLQ Recovery

```
Any consumer  →  processing fails after 3 retries (5s → 15s → 45s backoff)
      │
      └─ publish: dlq-events  ──► DLQ Replay Service (persisted in PostgreSQL)
                                         │
                                  GET /dlq/events        (operator investigates)
                                         │
                                  POST /dlq/replay/{id}  (operator triggers replay)
                                         │
                                         └─ re-publishes to original topic ──► re-processes ✓
```

### Kafka Topic Reference

| Topic | Partitions | Retention | Producers | Consumers |
|---|---|---|---|---|
| `order-created` | 3 | 7d | Order | Inventory, Notification, Analytics, Audit |
| `order-cancelled` | 3 | 7d | Order | Inventory (release), Notification, Audit |
| `inventory-reserved` | 3 | 7d | Inventory | Payment, Notification, Analytics, Audit |
| `inventory-failed` | 3 | 7d | Inventory | Notification, Audit |
| `inventory-release` | 3 | 7d | Payment, Order | Inventory |
| `payment-processed` | 3 | 7d | Payment | Notification, Analytics, Audit, Order |
| `payment-failed` | 3 | 7d | Payment | Notification, Audit, Inventory |
| `dlq-events` | 1 | **30d** | All services | DLQ Replay |

---

## 🛡️ Reliability Patterns

Each pattern below exists because the alternative has caused production outages.

### Transactional Outbox

The classic dual-write problem: writing to a database and then publishing to Kafka are two separate operations. If the process crashes between them, the event is permanently lost.

```sql
-- Single atomic transaction — both succeed or both fail
BEGIN;
  INSERT INTO orders (id, customer_id, status, ...) VALUES (...);
  INSERT INTO outbox_events (id, topic, payload, published) VALUES (..., false);
COMMIT;

-- Outbox poller (runs every 100ms)
SELECT * FROM outbox_events
WHERE published = false
FOR UPDATE SKIP LOCKED   -- safe for concurrent pollers
LIMIT 100;
-- Publishes to Kafka, then marks published = true
```

No event is ever lost, even if the service crashes mid-flight.

### Consumer Idempotency

Kafka guarantees at-least-once delivery. Without idempotent consumers, duplicate events cause double charges, double inventory decrements, and double notifications.

```sql
-- Before processing any event
INSERT INTO processed_events (event_id, processed_at)
VALUES ($1, NOW())
ON CONFLICT (event_id) DO NOTHING;

-- If 0 rows inserted: duplicate detected, skip silently
-- If 1 row inserted: new event, process normally
```

Combined with `enable.idempotence=true` on producers, this achieves effectively-once application semantics.

### Saga Pattern (Distributed Rollback)

No distributed locks. No two-phase commit. Failures trigger compensating events that each service handles independently.

```
Payment FAILS
    │
    ├─ publish payment-failed      → Notification sends cancellation email
    └─ publish inventory-release   → Inventory releases stock reservation

Each service responds to its event. No coordinator. No blocking.
```

### Full Reliability Matrix

| Pattern | Production Problem Solved | Implementation |
|---|---|---|
| **Transactional Outbox** | Dual-write / silent event loss | `outbox_events` table + `FOR UPDATE SKIP LOCKED` poller |
| **Consumer Idempotency** | Duplicate message processing | `processed_events` table — PK constraint on `event_id` |
| **Dead Letter Queue** | Poison pill messages blocking consumers | `dlq-events` topic (30d) → DLQ Replay Service REST API |
| **Exponential Backoff** | Thundering herd on downstream failure | `5s → 15s → 45s`, max 3 retries, then DLQ |
| **Saga (compensating events)** | Distributed consistency without 2PC | `payment-failed` triggers `inventory-release` |
| **Bulkhead isolation** | Connection pool exhaustion cascade | Per-service PostgreSQL pool (max 10–20 connections) |
| **Idempotent producer** | Duplicate Kafka message production | `enable.idempotence=true` on all producers |
| **Sliding-window rate limit** | API abuse and traffic spikes | Redis + 100 req/min/IP, fails open if Redis is unavailable |

---

## 🔬 Observability

### Distributed Tracing — OpenTelemetry + Jaeger

A single `trace_id` propagates through every service via Kafka message headers. One request, one trace, full waterfall.

```
POST /api/orders                                          trace: abc-123
     │
     ▼  Order Service          [Span 1: HTTP handler        12ms]
     │  ── Kafka publish ──────────────────────────────────────────────
     ▼  Inventory Service      [Span 2: Kafka consumer       8ms]
     │  ── Kafka publish ──────────────────────────────────────────────
     ▼  Payment Service        [Span 3: Payment processing  45ms]
     │  ── Kafka publish ──────────────────────────────────────────────
     ▼  Notification Service   [Span 4: Email dispatch       3ms]

Jaeger UI → filter by trace: abc-123 → full cross-service waterfall
```

Access at: **http://localhost:16686**

### Prometheus Metrics — 18 Custom Metrics

| Category | Metrics |
|---|---|
| **Orders** | `orders_created_total`, `orders_cancelled_total`, `processing_duration_seconds` (p50/p95/p99) |
| **Payments** | `payments_processed_total`, `payments_failed_total`, `payment_duration_seconds` |
| **Inventory** | `stock_reserved_total`, `stock_released_total`, `reservation_failures_total` |
| **DLQ** | `dlq_events_stored_total`, `dlq_events_replayed_total`, `dlq_replay_failures_total` |
| **Infrastructure** | `rate_limit_hits_total`, `outbox_published_total`, `notifications_sent_total` |

### Grafana Dashboard

Pre-built dashboard at `monitoring/grafana/dashboards/kafka-orders-system.json`.

```
┌───────────────────────────────────────────────────────────────────┐
│  Orders (24h) [time series] │ Payment Success [gauge] │ DLQ [stat]│
├───────────────────────────────────────────────────────────────────┤
│  End-to-End Latency p50/p95/p99      │  Payment Duration Heatmap  │
├───────────────────────────────────────────────────────────────────┤
│  Rate Limit Hits/hour  │  Stock Operations/min  │  Audit Event Rate│
└───────────────────────────────────────────────────────────────────┘
```

Import: Grafana UI → Dashboards → Import → upload the JSON file.

### Avro Schema Registry

All Kafka messages are Avro-encoded with schema evolution enforced at the registry level.

```json
// v1 → v2: backward-compatible field addition
// v1 consumers silently ignore the new field
{
  "name": "couponCode",
  "type": ["null", "string"],
  "default": null
}
```

A producer deploying a breaking schema change is rejected at publish time — not discovered when consumers crash.

---

## 🔒 Security

| Layer | Mechanism | Notes |
|---|---|---|
| **Authentication** | JWT Bearer tokens | Validated on every route via `auth.ts` middleware |
| **Rate limiting** | Redis sliding window | 100 req/min/IP · `X-RateLimit-*` response headers · fails open if Redis is down |
| **Input validation** | Zod schemas | All request bodies validated before any business logic executes |
| **HTTP hardening** | Helmet.js | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| **SQL injection** | Parameterized queries | `$1, $2` placeholders throughout — no string concatenation |
| **Secret management** | Kubernetes Secrets | DB credentials and API keys never stored in environment variables |
| **Transport security** | TLS via Ingress | TLS termination at the Kubernetes Ingress layer |
| **CORS** | Configurable allow-list | Per-environment origin configuration |

---

## 🚀 Quick Start

**Prerequisites:** Node.js v20+, Docker, Docker Compose

### Start Everything in 30 Seconds

```bash
git clone https://github.com/ajju853/Kafka-event-driven-order-system-architecture.git
cd kafka-event-driven-order-system-architecture

# Starts all 18 containers: Kafka, ZooKeeper, Schema Registry,
# PostgreSQL (×6), Redis, 7 services, frontend, Jaeger, Prometheus, Grafana
docker compose -f kafka-order-system/docker/docker-compose.yml up -d

# Verify all containers are healthy
docker compose -f kafka-order-system/docker/docker-compose.yml ps
```

### Access Points

| Interface | URL | Credentials |
|---|---|---|
| **Frontend** | http://localhost:3000 | — |
| **Order API** | http://localhost:4001 | `Bearer pk_test_order_system_2024` |
| **Kafka UI** | http://localhost:8080 | — |
| **Jaeger** | http://localhost:16686 | — |
| **Prometheus** | http://localhost:9090 | — |
| **Grafana** | http://localhost:3001 | `admin / admin` |
| **Schema Registry** | http://localhost:8081 | — |
| **DLQ Replay API** | http://localhost:4007/dlq/events | — |

### Test the Full Order Lifecycle

```bash
# 1. Create an order — triggers the complete pipeline automatically
curl -X POST http://localhost:4001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pk_test_order_system_2024" \
  -d '{
    "customerId": "550e8400-e29b-41d4-a716-446655440001",
    "items": [
      {
        "productId": "550e8400-e29b-41d4-a716-446655440010",
        "quantity": 2,
        "price": 29.99
      }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105",
      "country": "US"
    }
  }'

# 2. List all orders
curl http://localhost:4001/api/orders \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 3. Cancel an order
curl -X POST http://localhost:4001/api/orders/{ORDER_ID}/cancel \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 4. View events in the Dead Letter Queue
curl http://localhost:4007/dlq/events

# 5. Replay a failed event
curl -X POST http://localhost:4007/dlq/replay/{EVENT_ID}

# 6. Open Jaeger and trace your order end-to-end
open http://localhost:16686
```

---

## 🧪 Local Development (Without Docker)

```bash
# Install all workspace dependencies
npm install

# Start only infrastructure: Kafka, ZooKeeper, PostgreSQL, Redis, Jaeger, Schema Registry
docker compose -f kafka-order-system/docker/docker-compose.yml up -d \
  zookeeper kafka postgres redis schema-registry jaeger

# Start all 7 services with hot reload
npm run dev

# Start the frontend (separate terminal)
npm run dev:frontend
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all 7 services concurrently with hot reload |
| `npm run dev:frontend` | Start Next.js frontend on port 3000 |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all test suites |
| `npm run docker:up` | Full stack in Docker (18 containers) |
| `npm run docker:down` | Stop all containers and clean volumes |

---

## ☸️ Kubernetes Deployment

```bash
cd kafka-event-driven-order-system-architecture/kafka-order-system

# Apply manifests in dependency order
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/kafka.yaml
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/services.yaml
kubectl apply -f kubernetes/hpa.yaml
kubectl apply -f kubernetes/ingress.yaml

# Verify rollout
kubectl get pods -n order-system
kubectl rollout status deployment/order-service -n order-system
```

### Horizontal Pod Autoscaler Configuration

| Service | Min Replicas | Max Replicas | CPU Target |
|---|---|---|---|
| Order Service | 2 | 10 | 70% |
| Inventory Service | 2 | 8 | 70% |
| Payment Service | 2 | 6 | 70% |
| Frontend | 2 | 6 | 70% |
| Notification / Analytics / Audit | 1 | 4 | 70% |
| DLQ Replay | 1 | 3 | 70% |

### CI/CD Pipeline

```
Push to main
     │
     ▼
[Run tests]  →  [Build Docker images]  →  [Push to registry]  →  [kubectl apply]  →  [Verify rollout]
```

Pipeline defined at `.github/workflows/ci-cd.yml`.

---

## 📁 Project Structure

```
kafka-event-driven-order-system-architecture/
│
└── kafka-order-system/
    │
    ├── shared/                          # Shared Kafka event schemas (Zod) + TypeScript types
    │
    ├── services/
    │   ├── order-service/               # API Gateway + Transactional Outbox       port 4001
    │   ├── inventory-service/           # Stock management + Redis cache            port 4002
    │   ├── payment-service/             # Payment processing + saga events          port 4006
    │   ├── notification-service/        # Email / SMS / Push notifications          port 4003
    │   ├── analytics-service/           # Revenue metrics + daily aggregations      port 4004
    │   ├── audit-service/               # Immutable, append-only event log          port 4005
    │   └── dlq-replay-service/          # DLQ capture + operator replay REST API   port 4007
    │
    ├── frontend/                        # Next.js 14 — App Router, Redux, TanStack Query
    │
    ├── monitoring/
    │   ├── prometheus/prometheus.yml    # Scrape config for all 7 services
    │   └── grafana/dashboards/          # Pre-built Grafana dashboard JSON
    │
    ├── docker/docker-compose.yml        # 18-container local stack
    ├── kubernetes/                      # Deployments, Services, HPA, Ingress, Secrets
    ├── docs/                            # HLD, API reference, Kafka design, patterns
    └── .github/workflows/ci-cd.yml     # Test → Build → Push → Deploy pipeline
```

---

## 📖 Documentation

| Document | Contents |
|---|---|
| [`docs/HLD.md`](kafka-order-system/docs/HLD.md) | Full system architecture, component design, data flow, event lifecycle |
| [`docs/Kafka.md`](kafka-order-system/docs/Kafka.md) | Topic design, consumer groups, Avro schemas, exactly-once semantics |
| [`docs/API.md`](kafka-order-system/docs/API.md) | All REST endpoints with request and response examples |
| [`docs/Outbox.md`](kafka-order-system/docs/Outbox.md) | Transactional Outbox implementation — SQL, poller logic, failure scenarios |
| [`docs/Retry.md`](kafka-order-system/docs/Retry.md) | Backoff algorithm, configuration parameters, circuit breaking |
| [`docs/DLQ.md`](kafka-order-system/docs/DLQ.md) | DLQ capture logic, replay API reference, operator recovery workflow |
| [`docs/Security.md`](kafka-order-system/docs/Security.md) | JWT implementation, RBAC, rate limiting, injection prevention |
| [`docs/Observability.md`](kafka-order-system/docs/Observability.md) | OpenTelemetry setup, Jaeger configuration, Prometheus metrics reference |

---

## 🧠 Architecture Decision Records

| Decision | Alternative Rejected | Rationale |
|---|---|---|
| **Transactional Outbox** | Direct Kafka producer call after DB write | Direct approach risks losing events on process crash between the two writes. Outbox makes both atomic. |
| **Per-service PostgreSQL** | Shared database | Shared schema creates coupling, schema conflict risk, and eliminates independent scaling. |
| **Idempotent consumers** | Kafka Exactly-Once Transactions (EOS) | Kafka EOS adds significant operational complexity and performance overhead. Outbox + idempotent consumers achieves the same guarantee with less risk. |
| **Exponential backoff → DLQ** | Infinite retry | Infinite retry blocks consumer progress and hides the root cause. DLQ surfaces failures for human investigation. |
| **Saga with compensating events** | Two-Phase Commit (2PC) | 2PC requires a coordinator, holds distributed locks, and fails non-atomically. Sagas are async, simpler, and more resilient. |
| **Avro + Schema Registry** | Plain JSON | JSON has no schema enforcement. A producer deploying an incompatible change silently breaks all consumers. Schema Registry rejects incompatible changes at publish time. |

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
git commit -m "feat: your feature description"
git push origin feature/your-feature
# Open a Pull Request
```

**Open contribution areas:**
- End-to-end tests with Testcontainers
- gRPC for latency-sensitive internal service communication
- Prometheus alerting rules (consumer lag, DLQ growth rate, payment failure spikes)
- Circuit breaker with half-open state machine

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [**@ajju853**](https://github.com/ajju853) · [Portfolio](https://ajimpatelportfolio.ajimp340.workers.dev/) · [LinkedIn](https://www.linkedin.com/in/ajim-patel-b359192ab/)

<br/>

**If this helped you understand event-driven architecture, consider leaving a ⭐**

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,2,5,30&height=100&section=footer" width="100%"/>

</div>
