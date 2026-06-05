# Kafka Event-Driven Order Management System

<h3 align="center">
  Production-Grade Microservices · Event-Driven Architecture · Cloud-Native
</h3>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Apache_Kafka-7.6-231F20?logo=apache-kafka&logoColor=white" alt="Kafka">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white" alt="Kubernetes">
  <img src="https://img.shields.io/badge/OpenTelemetry-000000?logo=opentelemetry&logoColor=white" alt="OpenTelemetry">
  <img src="https://img.shields.io/badge/Jaeger-60C0E0?logo=jaeger&logoColor=white" alt="Jaeger">
  <img src="https://img.shields.io/badge/Prometheus-E6522C?logo=prometheus&logoColor=white" alt="Prometheus">
  <img src="https://img.shields.io/badge/Grafana-F46800?logo=grafana&logoColor=white" alt="Grafana">
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

<p align="center">
  A <strong>production-grade</strong> event-driven microservices platform for order management — built with the patterns that power real-world distributed systems at <strong>Uber</strong>, <strong>Netflix</strong>, and <strong>Shopify</strong>.
</p>

<hr>

## Table of Contents

- [📋 Overview](#-overview)
- [🏗️ Architecture](#-architecture)
- [✨ Key Features](#-key-features)
- [📦 Services](#-services)
- [⚡ Event Flow](#-event-flow)
- [🛡️ Reliability Patterns](#️-reliability-patterns)
- [🔬 Observability](#-observability)
- [🔒 Security](#-security)
- [🚀 Quick Start](#-quick-start)
- [🧪 Development](#-development)
- [☸️ Kubernetes Deployment](#️-kubernetes-deployment)
- [📊 Monitoring](#-monitoring)
- [📁 Project Structure](#-project-structure)
- [🧠 What Makes This Production-Grade?](#-what-makes-this-production-grade)
- [📖 Documentation](#-documentation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 📋 Overview

This is not a toy project. This is a **fully-featured, production-grade distributed system** built from the ground up to demonstrate enterprise-grade architectural patterns. It processes asynchronous order workflows across **7 independent microservices** connected through Apache Kafka, with fault tolerance, eventual consistency, and cloud-native deployment.

### What Problem Does It Solve?

Modern e-commerce platforms need to coordinate multiple services — order management, inventory, payments, notifications, analytics, auditing — without data loss, without tight coupling, and without a single point of failure. This system solves that using **event-driven architecture** with Kafka as the backbone.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│               Next.js Frontend (port 3000)                           │
│                  Redux Toolkit · TanStack Query                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ REST / HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                               │
│                    Order Service (port 4001)                         │
│                                                                      │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│    │  JWT Auth    │  │ Rate Limiter │  │ Request Logging      │    │
│    │  (Bearer)    │  │ (Redis SW)   │  │ (Morgan + Logger)    │    │
│    └──────────────┘  └──────────────┘  └──────────────────────┘    │
│                                                                      │
│    ┌──────────────────────────────────────────────────────────┐     │
│    │              Transactional Outbox Pattern                │     │
│    │   ┌─────────────┐  ┌────────────────┐  ┌──────────────┐ │     │
│    │   │ Order CRUD  │  │ Outbox Writer  │  │ Outbox       │ │     │
│    │   │ (Postgres)  │──▶ (Same Tx)      │──▶ Publisher    │─┼────┐│
│    │   └─────────────┘  └────────────────┘  │ (Poller)    │ │    ││
│    │                                        └──────────────┘ │    ││
│    └──────────────────────────────────────────────────────────┘    ││
└────────────────────────────────────┬───────────────────────────────┘│
                                     │ Produce Events                 ││
                                     ▼                               ││
        ╔══════════════════════════════════════════════════════════════╗│
        ║                 MESSAGE BROKER LAYER                       ║│
        ║               Apache Kafka 7.6 (3 Partitions)               ║▼
        ║                                                             ║
        ║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ║
        ║   │  order-  │  │inventory-│  │ payment- │  │  dlq-    │  ║
        ║   │ created  │  │ reserved │  │processed │  │ events   │  ║
        ║   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  ║
        ║   ┌────┴────┐  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐     ║
        ║   │ payment │  │inventory│  │payment  │  │inventory│     ║
        ║   │ -failed │  │-release │  │-failed  │  │-release │     ║
        ║   └─────────┘  └─────────┘  └─────────┘  └─────────┘     ║
        ╚═══════════════════╤═══════════╤═══════════════╤═════════════╝
                            │           │               │
       ┌────────────────────┘    ┌──────┘      ┌────────┘
       ▼                         ▼              ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ INVENTORY      │   │ PAYMENT        │   │ NOTIFICATION   │
│ SERVICE        │   │ SERVICE        │   │ SERVICE        │
│ (port 4002)    │   │ (port 4006)    │   │ (port 4003)    │
│                │   │                │   │                │
│ PostgreSQL     │   │ PostgreSQL     │   │ Email / SMS    │
│ Redis Cache    │   │ 90% Success    │   │ / Push         │
│ Lock Inventory │   │ Simulated      │   │                 │
└───────┬────────┘   └───────┬────────┘   └────────────────┘
        │                    │
        ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ ANALYTICS      │   │ AUDIT          │   │ DLQ REPLAY     │
│ SERVICE        │   │ SERVICE        │   │ SERVICE        │
│ (port 4004)    │   │ (port 4005)    │   │ (port 4007)    │
│                │   │                │   │                │
│ PostgreSQL     │   │ PostgreSQL     │   │ PostgreSQL     │
│ Daily Metrics  │   │ Immutable Log  │   │ View/Replay    │
│ Revenue Stats  │   │ Event History  │   │ Failed Events  │
└────────────────┘   └────────────────┘   └────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY LAYER                           │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│   │   Jaeger     │  │   Kafka UI   │  │ Schema Registry        │   │
│   │  Distributed │  │   (port      │  │ (port 8081)            │   │
│   │  Tracing     │  │   8080)      │  │ Avro · Versioned       │   │
│   │  (port 16686)│  │              │  │ Backward Compat        │   │
│   └──────────────┘  └──────────────┘  └────────────────────────┘   │
│                                                                      │
│   ┌────────────────────────────────────────────────────────┐        │
│   │  Prometheus (port 9090)  ◄──  /metrics (all services)  │        │
│   │  ┌──────────────────────────────────────────────────┐  │        │
│   │  │  Grafana (port 3000/dashboards)                  │  │        │
│   │  │  Order KPIs · Consumer Lag · DLQ Rate · Latency  │  │        │
│   │  └──────────────────────────────────────────────────┘  │        │
│   └────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🔄 Event-Driven Architecture
- Apache Kafka as the central nervous system — 8 topics, 7 consumer groups
- All inter-service communication is asynchronous and fault-tolerant
- No synchronous HTTP calls between services (no cascading failures)

### 📦 Transactional Outbox Pattern
- Order + event written in a **single database transaction**
- `FOR UPDATE SKIP LOCKED` polling ensures concurrent safety
- No dual-write problems, no lost events, no distributed transactions needed

### 🛡️ Consumer Idempotency (Effectively-Once)
- Every consumer maintains a `processed_events` table
- Duplicate events are detected by `event_id` (PK conflict) and silently skipped
- Achieves **Effectively-Once** semantics without Kafka transaction overhead

### 💀 Dead Letter Queue + Replay
- All failed events land in `dlq-events` topic after retry exhaustion
- **DLQ Replay Service** (port 4007) provides REST API to view and replay failed events
- Operators can fix root cause → replay → verify — no data loss

### 🔁 Exponential Backoff Retry
- Initial delay: **5 seconds**
- Multiplier: **3×** (5s → 15s → 45s)
- Max retries: **3** (configurable per service)
- Prevents thundering herd on failure recovery

### 💳 Payment Processing
- Dedicated Payment Service consumes `inventory-reserved` events
- 90% simulated success rate (configurable)
- On failure: publishes `payment-failed` + `inventory-release` to auto-rollback stock

### 📈 Real-Time Analytics
- Records every order/payment event with timestamps
- Generates daily revenue summaries and payment success rates
- Materialized metrics for dashboards

### 📋 Immutable Audit Log
- Every event is permanently recorded with full payload
- Query by `order_id` or `event_type`
- Supports compliance and debugging

### 🚦 Rate Limiting
- Redis sliding window algorithm — **100 requests/minute per IP**
- X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
- Graceful degradation (allows request if Redis is down)

### 🔐 JWT Authentication
- Bearer token validation on all API routes
- API key management via environment variables
- Optional auth for public endpoints

### 📊 Distributed Tracing
- OpenTelemetry SDK + Jaeger all-in-one collector
- Every HTTP request and Kafka message carries a **trace ID**
- View complete request flow across all 7 services in Jaeger UI

### 🧬 Schema Registry (Avro)
- Confluent Schema Registry with versioned Avro schemas
- `order-created-v1` → `order-created-v2` (backward compatible, added `couponCode`)
- Backward compatibility ensures safe schema evolution

### ☸️ Cloud-Native Deployment
- Docker Compose for local development (full stack in one command)
- Kubernetes manifests for production (Deployments, Services, HPA, Ingress)
- GitHub Actions CI/CD pipeline (test → build → push → deploy)

---

## 📦 Services

| # | Service | Port | Language | Database | Responsibilities |
|---|---------|------|----------|----------|------------------|
| 1 | **Order Service** (API Gateway) | `4001` | Node.js/TS | PostgreSQL + Redis | Auth, rate limiting, CRUD orders, outbox pattern, Kafka producer |
| 2 | **Inventory Service** | `4002` | Node.js/TS | PostgreSQL + Redis | Stock management, reservation, Redis cache, release |
| 3 | **Payment Service** | `4006` | Node.js/TS | PostgreSQL | Payment processing, transaction store, 90% success |
| 4 | **Notification Service** | `4003` | Node.js/TS | — | Email/SMS/Push notifications (simulated) |
| 5 | **Analytics Service** | `4004` | Node.js/TS | PostgreSQL | Order metrics, daily summaries, revenue stats |
| 6 | **Audit Service** | `4005` | Node.js/TS | PostgreSQL | Immutable event log, query by order/type |
| 7 | **DLQ Replay Service** | `4007` | Node.js/TS | PostgreSQL | View, search, and replay failed events |

### Supporting Infrastructure

| Component | Version | Purpose |
|-----------|---------|---------|
| Apache Kafka | 7.6 (Confluent) | Event bus with 3 partitions per topic |
| Zookeeper | 7.6 | Kafka coordination |
| PostgreSQL | 16 | Per-service databases (6 databases) |
| Redis | 7 | Caching + rate limiting |
| Schema Registry | 7.6 | Avro schema versioning |
| Jaeger | 1.55 | Distributed tracing UI |
| Kafka UI | Latest | Topic/consumer management |
| Prometheus | Latest | Metrics collection + alerting |
| Grafana | Latest | Dashboards + visualization |

---

## ⚡ Event Flow

### Happy Path: Complete Order Lifecycle

```mermaid
sequenceDiagram
    participant F as Frontend
    participant OS as Order Service
    participant K as Kafka
    participant IS as Inventory Service
    participant PS as Payment Service
    participant NS as Notification Service
    participant AS as Analytics Service
    participant AU as Audit Service

    F->>OS: POST /api/orders
    OS->>OS: Save order + outbox event (DB Tx)
    OS->>K: Publish order-created
    K->>IS: Consume order-created
    IS->>IS: Reserve inventory (Redis + PG)
    IS->>K: Publish inventory-reserved
    K->>PS: Consume inventory-reserved
    PS->>PS: Process payment (90% success)
    PS->>K: Publish payment-processed
    K->>NS: Notify customer
    K->>AS: Record metrics
    K->>AU: Audit trail
    K->>OS: Update order status
    OS->>OS: Set status = PAYMENT_PROCESSED
    OS-->>F: 201 Created (order response)
```

### Failure Path: Payment Fails → Auto-Rollback

```mermaid
sequenceDiagram
    participant PS as Payment Service
    participant K as Kafka
    participant IS as Inventory Service
    participant NS as Notification Service
    participant AU as Audit Service

    PS->>PS: Process payment → FAILED (10%)
    PS->>K: Publish payment-failed
    PS->>K: Publish inventory-release
    K->>IS: Consume inventory-release
    IS->>IS: Release reserved stock
    K->>NS: Notify customer of failure
    K->>AU: Audit payment failure
    Note over PS,AU: Inventory is auto-rolled back
    Note over PS,AU: No manual intervention needed
```

### DLQ Recovery Flow

```mermaid
sequenceDiagram
    participant SVC as Any Service
    participant K as Kafka
    participant DLQ as DLQ Replay Service
    participant OP as Operator

    SVC->>SVC: Event processing fails after 3 retries
    SVC->>K: Publish to dlq-events topic
    K->>DLQ: Consume dlq-events
    DLQ->>DLQ: Store in PostgreSQL (persistent)
    OP->>DLQ: GET /dlq/events (list failures)
    DLQ-->>OP: [ { eventId, error, topic, time } ]
    OP->>OP: Investigate & fix root cause
    OP->>DLQ: POST /dlq/replay/{eventId}
    DLQ->>K: Re-publish to original topic
    K->>SVC: Re-process successfully
    DLQ->>DLQ: Mark as replayed=true
```

### Kafka Topics & Event Types

| Topic | Partitions | Retention | Producer | Consumers | Schema Version |
|-------|-----------|-----------|----------|-----------|----------------|
| `order-created` | 3 | 7 days | Order Service | Inventory, Notification, Analytics, Audit | `order-created-v1` |
| `order-cancelled` | 3 | 7 days | Order Service | Inventory (release), Notification, Audit | `order-cancelled-v1` |
| `inventory-reserved` | 3 | 7 days | Inventory Service | Payment, Notification, Analytics, Audit | `inventory-reserved-v1` |
| `inventory-failed` | 3 | 7 days | Inventory Service | Notification, Audit | `inventory-failed-v1` |
| `inventory-release` | 3 | 7 days | Payment/Order Service | Inventory Service | `inventory-release-v1` |
| `payment-processed` | 3 | 7 days | Payment Service | Notification, Analytics, Audit, Order | `payment-processed-v1` |
| `payment-failed` | 3 | 7 days | Payment Service | Notification, Audit, Inventory (release) | `payment-failed-v1` |
| `dlq-events` | 1 | 30 days | All services | DLQ Replay Service | — |

---

## 🛡️ Reliability Patterns

This project implements the reliability patterns that power **Uber's payment system**, **Netflix's content pipeline**, and **Shopify's order processing**. Here's what each does and why it matters:

| Pattern | What It Does | Why It Matters | Implementation |
|---------|-------------|----------------|----------------|
| **Transaction Outbox** | Writes event + data in same DB transaction | Prevents dual-write problem — never lose an event | `outbox_events` table polled by `OutboxPublisher` with `FOR UPDATE SKIP LOCKED` |
| **Consumer Idempotency** | Skips duplicate events | Safe retries even with Kafka at-least-once delivery | `processed_events` table with PK = `event_id` |
| **Dead Letter Queue** | Captures unprocessable events | No data loss, operators can replay later | `dlq-events` topic consumed by DLQ Replay Service |
| **Exponential Backoff** | Waits longer between retries | Prevents thundering herd, gives dependent services time to recover | `5s → 15s → 45s` backoff, max 3 retries |
| **Circuit Breaker** | Stops retrying after budget exhausted | Prevents infinite loops and cascade failures | Max retry count per consumer config |
| **Bulkhead** | Per-service connection pools | One service can't exhaust all DB connections | Each service has its own PostgreSQL pool (max 10-20 connections) |
| **Saga Pattern** | Distributed rollback on failure | Maintains data consistency across services | Payment failure → auto-publish `inventory-release` |
| **Idempotent Producer** | No duplicate Kafka messages | Safe producer retries without duplicates | Kafka `enable.idempotence=true` |

### Exactly-Once Semantics

```
┌─────────────────────────────────────────────────────────────┐
│                    Exactly-Once Processing                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Kafka guarantees:        At-Least-Once                     │
│                                                             │
│  Producer guarantees:     Idempotent (no duplicates)        │
│                                                             │
│  Consumer guarantees:     Idempotent (duplicate detection)   │
│                                                             │
│  Application semantics:   Effectively-Once                  │
│                                                             │
│  How: Outbox pattern writes event and data atomically.     │
│       Consumers check processed_events before handling.    │
│       Duplicates are silently skipped.                     │
│                                                             │
│  Why not Kafka Exactly-Once?                                │
│  Kafka's EOS (transactions + zombie fencing) adds          │
│  significant complexity and performance overhead.          │
│  Outbox + idempotency is simpler, portable, and proven.   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔬 Observability

### Distributed Tracing (OpenTelemetry + Jaeger)

Every request — from frontend click to database write — generates a single **trace ID** that propagates across all services:

```text
Frontend HTTP ──► Order Service ──► Kafka ──► Payment Service ──► PostgreSQL
     │                │                  │           │                │
     └─── trace ID: abc123 ──────────────┼───────────┼────────────────┘
                                        Span 1     Span 2           Span 3
     (HTTP POST)                 (Kafka Produce)  (Kafka Consume)   (SQL Query)
```

Open [Jaeger UI](http://localhost:16686) to view traces, filter by service, and drill into span details.

### Prometheus Metrics

Every service exposes a `/metrics` endpoint (port 4001–4007) with structured business and performance metrics. Prometheus scrapes all services every 15s. A pre-built Grafana dashboard provides real-time visibility into:

- **Order throughput** — Created, cancelled, rate-limited
- **Payment health** — Success rate, failure count, processing duration
- **Inventory operations** — Reservations, releases, failures
- **Pipeline health** — DLQ event count, replay success/failure
- **Latency breakdown** — p50/p95/p99 processing and payment duration

### Enable Tracing

```bash
# Set environment variables
OTEL_ENABLED=true JAEGER_ENDPOINT=http://jaeger:14250 npm run dev
```

### Schema Registry (Avro)

| Subject | Versions | Compatibility |
|---------|----------|---------------|
| `order-created-value` | v1, v2 | BACKWARD |
| `inventory-reserved-value` | v1 | — |
| `payment-processed-value` | v1 | — |
| `payment-failed-value` | v1 | — |

**Schema Evolution Example — `order-created-v2`:**
```avro
{
  "name": "couponCode",
  "type": ["null", "string"],
  "default": null  // ← Backward compatible: old readers ignore new field
}
```

### Prometheus Metrics

Every service exposes a `/metrics` endpoint (port 4001–4007) scraped by Prometheus. All metrics are prefixed `kafka_orders_`:

| Metric | Type | Service | Description |
|--------|------|---------|-------------|
| `kafka_orders_created_total` | Counter | Order | Total orders placed |
| `kafka_orders_cancelled_total` | Counter | Order | Total orders cancelled |
| `kafka_orders_outbox_published_total` | Counter | Order | Outbox events published to Kafka |
| `kafka_orders_rate_limit_hits_total` | Counter | Order | Requests rejected by rate limiter |
| `kafka_orders_processing_duration_seconds` | Histogram | Order | Order processing latency (p50/p95/p99) |
| `kafka_orders_stock_reserved_total` | Counter | Inventory | Total stock reservations |
| `kafka_orders_stock_released_total` | Counter | Inventory | Total stock releases |
| `kafka_orders_stock_reservation_failures_total` | Counter | Inventory | Failed stock reservations |
| `kafka_orders_inventory_checks_total` | Counter | Inventory | Inventory stock checks |
| `kafka_orders_payments_processed_total` | Counter | Payment | Successful payments |
| `kafka_orders_payments_failed_total` | Counter | Payment | Failed payments |
| `kafka_orders_payment_duration_seconds` | Histogram | Payment | Payment processing latency |
| `kafka_orders_notifications_sent_total` | Counter | Notification | Notifications dispatched |
| `kafka_orders_analytics_events_total` | Counter | Analytics | Analytics events recorded |
| `kafka_orders_audit_events_total` | Counter | Audit | Audit events recorded |
| `kafka_orders_dlq_events_stored_total` | Counter | DLQ Replay | Events sent to DLQ |
| `kafka_orders_dlq_events_replayed_total` | Counter | DLQ Replay | Events replayed from DLQ |
| `kafka_orders_dlq_replay_failures_total` | Counter | DLQ Replay | Failed replay attempts |

---

## 🔒 Security

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| **API Authentication** | Bearer JWT tokens | Validated by `auth.ts` middleware on every request |
| **Rate Limiting** | Redis sliding window | 100 requests/minute per IP, configurable |
| **Helmet** | HTTP security headers | `helmet()` middleware on all services |
| **CORS** | Cross-origin controls | `cors()` with configurable origins |
| **Input Validation** | Zod schemas | All API inputs validated before processing |
| **SQL Injection** | Parameterized queries | All database queries use `$1, $2` placeholders |
| **Secrets Management** | Kubernetes Secrets | DB passwords, API keys stored in K8s Secrets |
| **TLS/SSL** | HTTPS | Ingress terminates TLS (configurable) |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v20+
- [Docker](https://docker.com) & [Docker Compose](https://docs.docker.com/compose/)
- [Kubectl](https://kubernetes.io/docs/tasks/tools/) (for K8s deployment)

### Run Full Stack with Docker (Recommended — 30 seconds)

```bash
git clone https://github.com/ajju853/Kafka-event-driven-order-system-architecture.git
cd kafka-event-driven-order-system-architecture

# Start everything: Kafka, PostgreSQL, Redis, all 7 services, frontend, Jaeger
docker compose -f kafka-order-system/docker/docker-compose.yml up -d

# Check all services are running
docker compose -f kafka-order-system/docker/docker-compose.yml ps
```

**What you get:**
```
SERVICE              PORT       STATUS
zookeeper:2181                  running
kafka:9092                      running  
postgres:5432                   running
redis:6379                      running
schema-registry:8081            running
jaeger:16686                    running
prometheus:9090                 running
grafana:3001                    running
kafka-ui:8080                   running
order-service:4001              running
inventory-service:4002          running
payment-service:4006            running
notification-service:4003       running
analytics-service:4004          running
audit-service:4005              running
dlq-replay-service:4007         running
frontend:3000                   running
```

### Access the System

| Component | URL | Credentials |
|-----------|-----|-------------|
| **Frontend** | http://localhost:3000 | — |
| **Order API** | http://localhost:4001/health | Bearer `pk_test_order_system_2024` |
| **Kafka UI** | http://localhost:8080 | — |
| **Jaeger Tracing** | http://localhost:16686 | — |
| **Schema Registry** | http://localhost:8081 | — |
| **Prometheus** | http://localhost:9090 | — |
| **Grafana** | http://localhost:3001 | admin/admin |
| **DLQ Replay API** | http://localhost:4007/dlq/events | — |

### Test the Order Flow

```bash
# 1. Create an order (auto-triggers inventory → payment → notification → analytics → audit)
curl -X POST http://localhost:4001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pk_test_order_system_2024" \
  -d '{
    "customerId": "550e8400-e29b-41d4-a716-446655440001",
    "items": [
      { "productId": "550e8400-e29b-41d4-a716-446655440010", "quantity": 2, "price": 29.99 }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105",
      "country": "US"
    }
  }'

# 2. List orders
curl http://localhost:4001/api/orders \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 3. Cancel an order
curl -X POST http://localhost:4001/api/orders/{ORDER_ID}/cancel \
  -H "Authorization: Bearer pk_test_order_system_2024"

# 4. Check DLQ for failed events
curl http://localhost:4007/dlq/events

# 5. Replay a failed event
curl -X POST http://localhost:4007/dlq/replay/{EVENT_ID}

# 6. View payment history
curl http://localhost:4006/payments

# 7. View Jaeger distributed traces
open http://localhost:16686
```

---

## 🧪 Development

### Local Setup (Without Docker)

```bash
# 1. Clone and install
git clone https://github.com/ajju853/Kafka-event-driven-order-system-architecture.git
cd kafka-event-driven-order-system-architecture

# 2. Install dependencies (auto-builds shared library)
npm install

# 3. Start infrastructure (Kafka, PostgreSQL, Redis, Jaeger)
docker compose -f kafka-order-system/docker/docker-compose.yml up -d \
  zookeeper kafka postgres redis schema-registry jaeger

# 4. Start all 7 services
npm run dev

# 5. Start frontend (separate terminal)
npm run dev:frontend
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all services concurrently |
| `npm run dev:frontend` | Start Next.js frontend |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all tests |
| `npm run docker:up` | Start full stack in Docker |
| `npm run docker:down` | Stop Docker stack |

---

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (kind, minikube, EKS, AKS, GKE)
- kubectl configured

### Deploy

```bash
cd kafka-event-driven-order-system-architecture/kafka-order-system

kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/kafka.yaml
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/services.yaml
kubectl apply -f kubernetes/hpa.yaml
kubectl apply -f kubernetes/ingress.yaml

# Verify all pods are running
kubectl get pods -n order-system

# Watch rollout status
kubectl rollout status deployment/order-service -n order-system
kubectl rollout status deployment/inventory-service -n order-system
kubectl rollout status deployment/payment-service -n order-system
kubectl rollout status deployment/frontend -n order-system
```

### Auto-Scaling (HPA)

| Service | Min Replicas | Max Replicas | CPU Target |
|---------|-------------|-------------|------------|
| Order Service | 2 | 10 | 70% |
| Inventory Service | 2 | 8 | 70% |
| Payment Service | 2 | 6 | 70% |
| Frontend | 2 | 6 | 70% |
| Notification Service | 1 | 4 | 70% |
| Analytics Service | 1 | 4 | 70% |
| Audit Service | 1 | 4 | 70% |
| DLQ Replay Service | 1 | 3 | 70% |

### CI/CD Pipeline

The GitHub Actions pipeline (`kafka-order-system/.github/workflows/ci-cd.yml`):

```mermaid
flowchart LR
    A[Push to main] --> B[Test all services]
    B --> C[Build Docker images]
    C --> D[Push to Registry]
    D --> E[Deploy to K8s]
    E --> F[Rollout Status]
```

---

## 📊 Monitoring

### Dashboards

| Tool | URL | Purpose |
|------|-----|---------|
| **Jaeger** | http://localhost:16686 | Distributed tracing across all services |
| **Kafka UI** | http://localhost:8080 | Topics, partitions, consumer groups, offsets |
| **Schema Registry** | http://localhost:8081 | Avro schema versions and compatibility |
| **Prometheus** | http://localhost:9090 | Metric collection + querying (PromQL) |
| **Grafana** | http://localhost:3001 | Full dashboard suite (pre-built JSON) |

### Pre-Built Grafana Dashboard

A complete dashboard (`monitoring/grafana/dashboards/kafka-orders-system.json`) is included with these panels:

```
┌─────────────────────────────────────────────────────────────┐
│  Orders Created — 24h Sparkline   │  Payment Success Rate   │
│  [Time series: kafka_orders_]     │  [Gauge: 92.3%]         │
├─────────────────────────────────────────────────────────────┤
│  Orders by Status                  │  Rate Limit Hits       │
│  [Bar chart: PENDING / CANCELLED]  │  [Stat: last hour]     │
├─────────────────────────────────────────────────────────────┤
│  Payment Duration (p50/p95/p99)    │  Processing Duration   │
│  [Line chart: 0.2s / 0.5s / 1.0s] │  [Line chart: latency] │
├─────────────────────────────────────────────────────────────┤
│  Top Service Metrics               │  DLQ Event Summary     │
│  [Table: all kafka_orders_*]       │  [Stat: stored/replayed]│
└─────────────────────────────────────────────────────────────┘
```

Import from Grafana UI: **Dashboards → Import → Upload `monitoring/grafana/dashboards/kafka-orders-system.json`**

---

## 📁 Project Structure

```
kafka-event-driven-order-system-architecture/
│
├── kafka-order-system/                    # Main project directory
│   │
│   ├── shared/                            # Shared library (workspace)
│   │   └── src/
│   │       ├── events/                    # Kafka event schemas (Zod)
│   │       │   ├── index.ts
│   │       │   └── order-events.ts        # All event types & topics
│   │       ├── types/                     # Shared TypeScript types
│   │       │   ├── index.ts
│   │       │   └── api.ts
│   │       └── index.ts                   # Re-exports everything
│   │
│   ├── services/                          # All microservices
│   │   │
│   │   ├── order-service/                 # API Gateway (port 4001)
│   │   │   ├── src/
│   │   │   │   ├── config/                # Environment configuration
│   │   │   │   ├── consumers/             # Kafka consumer (status updates)
│   │   │   │   ├── controllers/           # REST endpoints
│   │   │   │   ├── middleware/            # Auth, rate limiting, error handler
│   │   │   │   ├── models/               # Database schema + pool
│   │   │   │   ├── services/             # Kafka producer, outbox publisher
│   │   │   │   └── utils/               # Logger, tracing
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   ├── inventory-service/             # Inventory (port 4002)
│   │   │   ├── src/
│   │   │   │   ├── consumers/            # Order event consumer
│   │   │   │   ├── controllers/          # REST endpoints
│   │   │   │   ├── models/              # DB + Redis
│   │   │   │   ├── services/            # Stock management
│   │   │   │   └── utils/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   ├── payment-service/               # Payment (port 4006)
│   │   │   ├── src/
│   │   │   │   ├── consumers/            # Inventory-reserved consumer
│   │   │   │   ├── models/              # Payment table schema
│   │   │   │   ├── services/            # Payment processor
│   │   │   │   └── utils/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   ├── notification-service/          # Notifications (port 4003)
│   │   │   ├── src/
│   │   │   │   ├── consumers/            # All event consumers
│   │   │   │   └── utils/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   ├── analytics-service/             # Analytics (port 4004)
│   │   │   ├── src/
│   │   │   │   ├── consumers/            # Order/payment consumers
│   │   │   │   ├── models/              # Metrics table
│   │   │   │   ├── services/            # Metric recording
│   │   │   │   └── utils/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   ├── audit-service/                 # Audit (port 4005)
│   │   │   ├── src/
│   │   │   │   ├── consumers/            # All event consumers
│   │   │   │   ├── models/              # Audit log table
│   │   │   │   ├── services/            # Event recording
│   │   │   │   └── utils/
│   │   │   ├── Dockerfile
│   │   │   └── package.json
│   │   │
│   │   └── dlq-replay-service/            # DLQ Replay (port 4007)
│   │       ├── src/
│   │       │   ├── controllers/          # REST endpoints
│   │       │   ├── services/            # DLQ consumer + replay
│   │       │   └── utils/
│   │       ├── Dockerfile
│   │       └── package.json
│   │
│   ├── frontend/                          # Next.js 14 UI (port 3000)
│   │   ├── src/
│   │   │   ├── app/                      # App Router pages
│   │   │   │   ├── admin/               # Admin dashboard
│   │   │   │   ├── cart/                # Shopping cart
│   │   │   │   ├── checkout/            # Checkout flow
│   │   │   │   ├── orders/              # Order list + detail
│   │   │   │   ├── products/            # Product catalog
│   │   │   │   ├── layout.tsx           # Root layout
│   │   │   │   └── page.tsx             # Home page
│   │   │   ├── components/              # Reusable UI components
│   │   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── lib/                     # API client + utilities
│   │   │   ├── store/                   # Redux Toolkit store
│   │   │   └── types/                   # TypeScript interfaces
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── monitoring/                        # Prometheus + Grafana
│   │   ├── prometheus/
│   │   │   └── prometheus.yml            # Scrape config (all 7 services)
│   │   └── grafana/
│   │       ├── datasources/
│   │       │   └── prometheus.yml        # Grafana → Prometheus datasource
│   │       └── dashboards/
│   │           ├── dashboard.yaml        # Dashboard auto-provisioning
│   │           └── kafka-orders-system.json  # Pre-built order monitoring
│   │
│   ├── docker/                            # Docker Compose
│   │   ├── docker-compose.yml            # Full stack (18 containers)
│   │   └── init-multi-db.sh             # PostgreSQL multi-database init
│   │
│   ├── kubernetes/                        # Kubernetes manifests
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── secrets.yaml
│   │   ├── kafka.yaml                    # Kafka + Zookeeper
│   │   ├── postgres.yaml                 # PostgreSQL StatefulSet
│   │   ├── redis.yaml                    # Redis StatefulSet
│   │   ├── services.yaml                # All service Deployments
│   │   ├── hpa.yaml                     # Auto-scaling rules
│   │   └── ingress.yaml                 # API Gateway Ingress
│   │
│   ├── docs/                              # Detailed documentation
│   │   ├── HLD.md                        # High-Level Design
│   │   ├── API.md                        # API Reference
│   │   ├── Kafka.md                      # Kafka Design
│   │   ├── Outbox.md                     # Transactional Outbox
│   │   ├── Retry.md                      # Retry Strategy
│   │   ├── DLQ.md                        # Dead Letter Queue
│   │   ├── Security.md                   # Security Architecture
│   │   └── Observability.md             # OpenTelemetry, Jaeger, Schema
│   │
│   ├── .github/workflows/                 # CI/CD
│   │   └── ci-cd.yml                    # GitHub Actions pipeline
│   │
│   ├── diagrams/                          # Architecture diagrams
│   ├── package.json                      # Root workspace config
│   ├── .gitignore
│   └── README.md                         # This file
│
└── .gitignore
```

---

## 🧠 What Makes This Production-Grade?

Every architecture decision in this project solves a real problem that occurs in production distributed systems:

### 1. No Dual-Write Problem
**Problem:** Writing to DB and Kafka in separate steps means if one fails, data is inconsistent.
**Solution:** Transactional Outbox writes both in one DB transaction. The outbox poller guarantees delivery.

### 2. No Data Loss
**Problem:** If a consumer crashes mid-processing, the message is lost.
**Solution:** Kafka stores messages on disk with configurable retention. At-least-once delivery + consumer idempotency means no data loss.

### 3. No Cascading Failures
**Problem:** If Payment Service is down, Order Service blocks waiting for response.
**Solution:** All inter-service communication is async via Kafka. Services don't wait on each other.

### 4. No Infinite Retry Loops
**Problem:** A bad message keeps retrying forever, wasting resources.
**Solution:** Max 3 retries with exponential backoff, then DLQ. Human operator investigates.

### 5. No Poison Pill Messages
**Problem:** One bad message blocks the entire consumer, preventing processing of good messages.
**Solution:** DLQ captures the poison pill. Consumer continues processing healthy messages.

### 6. No Manual Rollback
**Problem:** Payment succeeds but inventory was never reserved — data inconsistency.
**Solution:** Saga pattern with compensating events. Payment failure → auto-publish inventory-release.

### 7. No Blind Spots
**Problem:** Debugging distributed failures is nearly impossible without tracing.
**Solution:** OpenTelemetry trace ID propagates across every service and Kafka message. Full visibility in Jaeger.

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [High-Level Design](kafka-order-system/docs/HLD.md) | Full architecture, components, data flow, event lifecycle |
| [Kafka Design](kafka-order-system/docs/Kafka.md) | Topics, consumer groups, Avro schemas, exactly-once |
| [API Reference](kafka-order-system/docs/API.md) | All REST endpoints with request/response examples |
| [Outbox Pattern](kafka-order-system/docs/Outbox.md) | Implementation deep-dive with SQL queries |
| [Retry Strategy](kafka-order-system/docs/Retry.md) | Backoff algorithm, configuration, circuit breaking |
| [Dead Letter Queue](kafka-order-system/docs/DLQ.md) | DLQ consumption, replay API, recovery workflow |
| [Security](kafka-order-system/docs/Security.md) | JWT, RBAC, rate limiting, compliance |
| [Observability](kafka-order-system/docs/Observability.md) | OpenTelemetry, Jaeger, Schema Registry, metrics |

---

## 🤝 Contributing

Contributions are welcome! This project is designed to be a learning resource and portfolio piece. Here's how to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contributions

- **End-to-end tests** — Integration tests with Testcontainers
- **gRPC** — Internal service-to-service gRPC for synchronous paths
- **Circuit breaker** — More sophisticated circuit breaker with half-open state
- **Alerting rules** — Prometheus alerting rules for payment failures, high consumer lag, DLQ growth

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/ajju853">@ajju853</a>
  <br><br>
  <strong>⭐ Star this repo if you find it useful! ⭐</strong>
</p>
