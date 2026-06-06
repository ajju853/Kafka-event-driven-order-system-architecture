# Event Sourcing Architecture

## Overview

Every state change is stored as an immutable event in `event_store`, replacing direct writes to the `orders` table.

## Flow

```
API Request (POST /api/orders)
       │
       ▼
  Build DomainEvent (OrderCreated)
       │
       ├──► Append to event_store (event_store table)
       │
       ├──► Insert into outbox_events (Kafka publishing)
       │
       └──► Project to read model (orders table)
```

## Event Store Schema

```sql
event_store (
    id              UUID PRIMARY KEY,         -- internal row id
    event_id        UUID NOT NULL,            -- business event id
    aggregate_id    UUID NOT NULL,            -- order id
    aggregate_type  VARCHAR(100) NOT NULL,    -- "order"
    event_type      VARCHAR(100) NOT NULL,    -- "OrderCreated"
    version         INTEGER NOT NULL,         -- event version
    payload         JSONB NOT NULL,           -- event body
    metadata        JSONB,                    -- optional metadata
    timestamp       TIMESTAMPTZ NOT NULL,     -- when event occurred
    created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

## Domain Events by Service

| Service | Events | Projected Tables |
|---|---|---|
| **order-service** | `OrderCreated`, `OrderCancelled`, `PaymentProcessed`, `PaymentFailed`, `InventoryReserved`, `InventoryFailed` | `orders`, `order_items` |
| **payment-service** | `PaymentProcessed`, `PaymentFailed` | `payments` |
| **inventory-service** | `StockReserved`, `StockReservationFailed`, `StockReleased` | `inventory_reservations` |
| **analytics-service** | — (Kafka projections only) | `order_metrics`, `daily_order_summary` |
| **audit-service** | — (append-only log) | `event_audit_log` |
| **notification-service** | — (stateless) | — |

## Per-Service Files

| Service | Event Sourcing | Projections | Admin Routes |
|---|---|---|---|
| order-service | `services/event-sourcing.ts` | `projections/order-projection.ts` | `POST /admin/replay`, `GET /admin/events` |
| payment-service | `services/event-sourcing.ts` | `projections/payment-projection.ts` | `POST /admin/replay`, `GET /admin/events` |
| inventory-service | `services/event-sourcing.ts` | `projections/inventory-projection.ts` | `POST /admin/replay`, `GET /admin/events` |
| analytics-service | — | — | `POST /admin/replay/analytics`, `GET /admin/events` |
| audit-service | — | — | `GET /admin/events` |
| notification-service | — | — | `GET /admin/events` |

## Event Replay Service (formerly dlq-replay-service)

In addition to DLQ management, the service provides cross-service replay coordination:

```http
POST /replay/orders      # Orchestrates order event replay
POST /replay/payments    # Orchestrates payment event replay
POST /replay/inventory   # Orchestrates inventory event replay
GET  /replay/status      # Event counts by aggregate_type
```

## Architectures

```
order-service:                         payment-service:
┌─────────────────────┐                ┌──────────────────────┐
│ POST /api/orders    │                │ Kafka (inventory-    │
│   ↓                 │                │       reserved)      │
│ Append OrderCreated │                │   ↓                  │
│   ↓                 │                │ processPayment()     │
│ Outbox → Kafka      │                │   ↓                  │
│   ↓                 │                │ Append PaymentEvent  │
│ Project → orders    │                │   ↓                  │
└─────────────────────┘                │ Project → payments   │
                                       └──────────────────────┘

inventory-service:
┌───────────────────────────────────┐
│ reserveStock()                    │
│   ↓                               │
│ Check availability (FOR UPDATE)   │
│   ↓                               │
│ Append StockReserved / Failed     │
│   ↓                               │
│ Project → inventory_reservations  │
│   ↓                               │
│ Publish to Kafka                  │
└───────────────────────────────────┘
```
