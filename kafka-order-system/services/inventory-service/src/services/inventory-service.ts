import { Pool } from "pg";
import { Redis } from "ioredis";
import { logger } from "../utils/logger";
import { stockReserved, stockReleased, stockReservationFailures, inventoryChecks } from "../metrics";
import {
  buildStockReservedEvent,
  buildStockReservationFailedEvent,
  buildStockReleasedEvent,
  inventoryEventStore,
} from "./event-sourcing";
import { projectInventoryEvent } from "../projections/inventory-projection";

const CACHE_TTL = 3600;

export class InventoryService {
  private pool: Pool;
  private redis: Redis;

  constructor(pool: Pool, redis: Redis) {
    this.pool = pool;
    this.redis = redis;
  }

  async getProduct(productId: string): Promise<unknown | null> {
    const cached = await this.redis.get(`product:${productId}`);
    if (cached) return JSON.parse(cached);

    const result = await this.pool.query(
      "SELECT * FROM products WHERE id = $1",
      [productId]
    );
    if (result.rows.length === 0) return null;

    const product = result.rows[0];
    await this.redis.setex(`product:${productId}`, CACHE_TTL, JSON.stringify(product));
    return product;
  }

  async checkStock(productId: string, quantity: number): Promise<boolean> {
    inventoryChecks.inc();
    const result = await this.pool.query(
      "SELECT available_quantity FROM products WHERE id = $1",
      [productId]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].available_quantity >= quantity;
  }

  async reserveStock(orderId: string, items: Array<{ productId: string; quantity: number }>): Promise<{
    success: boolean;
    failures: Array<{ productId: string; available: number; requested: number }>;
  }> {
    const client = await this.pool.connect();
    const failures: Array<{ productId: string; available: number; requested: number }> = [];

    try {
      await client.query("BEGIN");

      for (const item of items) {
        const result = await client.query(
          "SELECT available_quantity FROM products WHERE id = $1 FOR UPDATE",
          [item.productId]
        );

        if (result.rows.length === 0 || result.rows[0].available_quantity < item.quantity) {
          failures.push({
            productId: item.productId,
            available: result.rows[0]?.available_quantity || 0,
            requested: item.quantity,
          });
        }
      }

      if (failures.length > 0) {
        await client.query("ROLLBACK");
        stockReservationFailures.inc(failures.length);

        const event = buildStockReservationFailedEvent(orderId, failures);
        await inventoryEventStore.append(event);

        return { success: false, failures };
      }

      for (const item of items) {
        await client.query(
          "UPDATE products SET available_quantity = available_quantity - $1 WHERE id = $2",
          [item.quantity, item.productId]
        );
        await client.query(
          "INSERT INTO reservations (id, order_id, product_id, quantity, status) VALUES (gen_random_uuid(), $1, $2, $3, 'RESERVED')",
          [orderId, item.productId, item.quantity]
        );
        await this.redis.del(`product:${item.productId}`);
      }

      const event = buildStockReservedEvent(
        orderId,
        items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
      await inventoryEventStore.append(event);
      await projectInventoryEvent(client, event);

      await client.query("COMMIT");

      stockReserved.inc(items.length);
      logger.info("Stock reserved via event sourcing", { orderId });
      return { success: true, failures: [] };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Inventory reservation failed", { orderId, error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }

  async releaseStock(orderId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const event = buildStockReleasedEvent(orderId, items, "payment_failed");
      await inventoryEventStore.append(event);

      for (const item of items) {
        await client.query(
          "UPDATE products SET available_quantity = available_quantity + $1 WHERE id = $2",
          [item.quantity, item.productId]
        );
        await this.redis.del(`product:${item.productId}`);
      }
      await client.query(
        "UPDATE reservations SET status = 'RELEASED' WHERE order_id = $1",
        [orderId]
      );

      await projectInventoryEvent(client, event);

      await client.query("COMMIT");
      stockReleased.inc(items.length);
      logger.info("Stock released for order via event sourcing", { orderId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
