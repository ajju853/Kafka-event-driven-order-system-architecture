import { PoolClient } from "pg";
import { logger } from "../utils/logger";
import { eventReplayed } from "../metrics";
import { ORDER_STATUS } from "@kafka-order-system/shared";

interface ProjectableEvent {
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  id?: string;
}

export async function projectOrderEvent(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  switch (event.eventType) {
    case "OrderCreated":
      await projectOrderCreated(client, event);
      break;
    case "OrderCancelled":
      await projectOrderCancelled(client, event);
      break;
    case "PaymentProcessed":
      await projectPaymentProcessed(client, event);
      break;
    case "PaymentFailed":
      await projectPaymentFailed(client, event);
      break;
    case "InventoryReserved":
      await projectInventoryReserved(client, event);
      break;
    default:
      logger.debug("No projection handler for event type", {
        eventType: event.eventType,
      });
  }
}

async function projectOrderCreated(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  const { orderId, customerId, items, totalAmount, shippingAddress } =
    event.payload as Record<string, unknown>;

  await client.query(
    `INSERT INTO orders (id, customer_id, status, total_amount, shipping_address, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       total_amount = EXCLUDED.total_amount,
       shipping_address = EXCLUDED.shipping_address,
       updated_at = EXCLUDED.updated_at`,
    [
      orderId as string,
      customerId as string,
      ORDER_STATUS.CREATED,
      totalAmount as number,
      JSON.stringify(shippingAddress),
      event.timestamp,
      event.timestamp,
    ]
  );

  const orderItems = items as Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;

  for (const item of orderItems) {
    await client.query(
      `INSERT INTO order_items (id, order_id, product_id, quantity, price, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        `${event.aggregateId}-${item.productId}`,
        orderId as string,
        item.productId,
        item.quantity,
        item.price,
        event.timestamp,
      ]
    );
  }

  eventReplayed.inc();
}

async function projectOrderCancelled(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  const { orderId } = event.payload as Record<string, unknown>;

  await client.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [ORDER_STATUS.CANCELLED, orderId as string]
  );

  eventReplayed.inc();
}

async function projectPaymentProcessed(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  const { orderId } = event.payload as Record<string, unknown>;

  await client.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [ORDER_STATUS.PAYMENT_PROCESSED, orderId as string]
  );

  eventReplayed.inc();
}

async function projectPaymentFailed(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  const { orderId } = event.payload as Record<string, unknown>;

  await client.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [ORDER_STATUS.PAYMENT_FAILED, orderId as string]
  );

  eventReplayed.inc();
}

async function projectInventoryReserved(
  client: PoolClient,
  event: ProjectableEvent
): Promise<void> {
  const { orderId } = event.payload as Record<string, unknown>;

  await client.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [ORDER_STATUS.INVENTORY_RESERVED, orderId as string]
  );

  eventReplayed.inc();
}
