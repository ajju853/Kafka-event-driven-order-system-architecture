import { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

export async function projectInventoryEvent(
  client: PoolClient,
  event: { eventType: string; aggregateId: string; payload: Record<string, unknown>; timestamp: Date }
): Promise<void> {
  const payload = event.payload;

  switch (event.eventType) {
    case "StockReserved": {
      const items = payload.items as Array<{ productId: string; quantity: number }>;
      for (const item of items) {
        await client.query(
          `INSERT INTO inventory_reservations (id, order_id, product_id, quantity, status, created_at)
           VALUES ($1, $2, $3, $4, 'RESERVED', $5)
           ON CONFLICT (id) DO NOTHING`,
          [`${event.aggregateId}-${item.productId}`, event.aggregateId, item.productId, item.quantity, event.timestamp]
        );
      }
      logger.debug("Stock reservation projected", { orderId: event.aggregateId });
      break;
    }

    case "StockReservationFailed":
      logger.debug("Stock reservation failure projected", { orderId: event.aggregateId, failures: payload.failures });
      break;

    case "StockReleased": {
      const items = payload.items as Array<{ productId: string; quantity: number }>;
      await client.query(
        `UPDATE inventory_reservations SET status = 'RELEASED' WHERE order_id = $1`,
        [event.aggregateId]
      );
      logger.debug("Stock release projected", { orderId: event.aggregateId });
      break;
    }
  }
}
