import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { eventsProjected } from "../metrics";

type StoredEvent = {
  id: string;
  aggregateId: string;
  eventType: string;
  version: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

function isoDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return new Date(val as string).toISOString();
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  return parseFloat(val as string) || 0;
}

export async function projectEvent(event: StoredEvent): Promise<void> {
  switch (event.eventType) {
    case "OrderCreated":
      await handleOrderCreated(event);
      break;
    case "OrderShipped":
      await handleOrderShipped(event);
      break;
    case "OrderDelivered":
      await handleOrderDelivered(event);
      break;
    case "PaymentProcessed":
      await handlePaymentProcessed(event);
      break;
    case "OrderCancelled":
      await handleOrderCancelled(event);
      break;
    case "InventoryReserved":
      await handleInventoryReserved(event);
      break;
    case "InventoryReservationFailed":
      await handleInventoryReservationFailed(event);
      break;
    default:
      logger.warn("Unknown event type in projector", {
        eventType: event.eventType,
      });
      return;
  }

  await insertTimeline(event);

  eventsProjected.inc();
}

async function handleOrderCreated(event: StoredEvent): Promise<void> {
  const p = event.payload;
  const items = (p.items as Array<Record<string, unknown>>) || [];
  const total = items.reduce((sum: number, i: Record<string, unknown>) => sum + num(i.price), 0);

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO order_summary (order_id, customer_id, status, total_amount, item_count, shipping_address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (order_id) DO UPDATE SET
         status = EXCLUDED.status,
         total_amount = EXCLUDED.total_amount,
         item_count = EXCLUDED.item_count,
         updated_at = EXCLUDED.updated_at`,
      [
        event.aggregateId,
        p.customerId,
        "CREATED",
        total,
        items.length,
        JSON.stringify(p.shippingAddress || {}),
        isoDate(event.occurredAt),
        isoDate(event.occurredAt),
      ]
    );

    await client.query(
      `INSERT INTO customer_orders (customer_id, order_id, total_amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_id, order_id) DO NOTHING`,
      [p.customerId, event.aggregateId, total, "CREATED", isoDate(event.occurredAt)]
    );
  } finally {
    client.release();
  }
}

async function handleOrderShipped(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET status = $1, updated_at = $2 WHERE order_id = $3`,
      ["SHIPPED", isoDate(event.occurredAt), event.aggregateId]
    );
    await client.query(
      `UPDATE customer_orders SET status = $1 WHERE order_id = $2`,
      ["SHIPPED", event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function handleOrderDelivered(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET status = $1, updated_at = $2 WHERE order_id = $3`,
      ["DELIVERED", isoDate(event.occurredAt), event.aggregateId]
    );
    await client.query(
      `UPDATE customer_orders SET status = $1 WHERE order_id = $2`,
      ["DELIVERED", event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function handlePaymentProcessed(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET payment_status = $1, updated_at = $2 WHERE order_id = $3`,
      ["PAID", isoDate(event.occurredAt), event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function handleOrderCancelled(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET status = $1, updated_at = $2 WHERE order_id = $3`,
      ["CANCELLED", isoDate(event.occurredAt), event.aggregateId]
    );
    await client.query(
      `UPDATE customer_orders SET status = $1 WHERE order_id = $2`,
      ["CANCELLED", event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function handleInventoryReserved(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET inventory_status = $1, updated_at = $2 WHERE order_id = $3`,
      ["RESERVED", isoDate(event.occurredAt), event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function handleInventoryReservationFailed(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE order_summary SET inventory_status = $1, status = $2, updated_at = $3 WHERE order_id = $4`,
      ["FAILED", "CANCELLED", isoDate(event.occurredAt), event.aggregateId]
    );
    await client.query(
      `UPDATE customer_orders SET status = $1 WHERE order_id = $2`,
      ["CANCELLED", event.aggregateId]
    );
  } finally {
    client.release();
  }
}

async function insertTimeline(event: StoredEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO order_timeline (id, order_id, event_type, version, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.id,
        event.aggregateId,
        event.eventType,
        event.version,
        JSON.stringify(event.payload),
        isoDate(event.occurredAt),
      ]
    );
  } finally {
    client.release();
  }
}
