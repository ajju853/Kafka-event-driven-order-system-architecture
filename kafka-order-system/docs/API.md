# API Documentation

## Order Service

### Create Order

```http
POST /api/orders
```

**Request:**
```json
{
  "customerId": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "productId": "11111111-1111-1111-1111-111111111001",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "orderId": "660e8400-e29b-41d4-a716-446655440001",
    "status": "CREATED"
  },
  "timestamp": "2026-06-05T12:00:00.000Z"
}
```

### List Orders

```http
GET /api/orders?page=1&limit=20&status=CREATED
```

### Get Order

```http
GET /api/orders/{orderId}
```

### Cancel Order

```http
POST /api/orders/{orderId}/cancel
```

**Request:**
```json
{
  "reason": "User requested cancellation"
}
```

## Inventory Service

### Get Product Inventory

```http
GET /api/inventory/{productId}
```

### Get Order Reservations

```http
GET /api/reservations/order/{orderId}
```

## Analytics Service

### Dashboard Metrics

```http
GET /api/analytics/dashboard
```

### Daily Summary

```http
GET /api/analytics/daily?days=7
```

## Audit Service

### Get Audit Logs

```http
GET /api/audit/logs?eventType=ORDER_CREATED&page=1&limit=50
```

### Audit Stats

```http
GET /api/audit/stats
```

## Health Check

```http
GET /health
```
