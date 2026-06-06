import { v4 as uuidv4 } from "uuid";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import {
  CreateOrderRequest,
  CreateOrderResponse,
  ORDER_STATUS,
} from "@kafka-order-system/shared";
import {
  buildOrderCreatedEvent,
  buildOrderCancelledEvent,
  appendOrderEvent,
} from "./event-sourcing";
import { projectOrderEvent } from "../projections/order-projection";

export class OrderService {
  async createOrder(
    request: CreateOrderRequest
  ): Promise<CreateOrderResponse> {
    const orderId = uuidv4();
    const totalAmount = request.items.reduce((sum, item) => sum + item.price, 0);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const event = buildOrderCreatedEvent(
        orderId,
        request.customerId,
        request.items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        totalAmount,
        request.shippingAddress as Record<string, unknown>
      );

      await appendOrderEvent(event);

      const outboxPayload = {
        eventId: event.eventId,
        eventType: "ORDER_CREATED",
        orderId,
        customerId: request.customerId,
        items: request.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
        })),
        totalAmount,
        shippingAddress: request.shippingAddress,
        timestamp: event.timestamp.toISOString(),
        version: 1,
      };

      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          event.eventId,
          "order",
          orderId,
          "ORDER_CREATED",
          JSON.stringify(outboxPayload),
        ]
      );

      await projectOrderEvent(client, event);

      await client.query("COMMIT");

      logger.info("Order created with event sourcing", {
        orderId,
        customerId: request.customerId,
        eventId: event.eventId,
      });

      return { orderId, status: ORDER_STATUS.CREATED };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to create order", {
        error: (error as Error).message,
      });
      throw new Error("Failed to create order");
    } finally {
      client.release();
    }
  }

  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT status, customer_id FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (result.rows.length === 0) {
        throw new Error("Order not found");
      }

      const currentStatus = result.rows[0].status;
      if (
        currentStatus === ORDER_STATUS.SHIPPING ||
        currentStatus === ORDER_STATUS.DELIVERED ||
        currentStatus === ORDER_STATUS.CANCELLED
      ) {
        throw new Error(`Cannot cancel order in status: ${currentStatus}`);
      }

      const event = buildOrderCancelledEvent(
        orderId,
        result.rows[0].customer_id,
        reason
      );

      await appendOrderEvent(event);

      await client.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          event.eventId,
          "order",
          orderId,
          "ORDER_CANCELLED",
          JSON.stringify({
            eventId: event.eventId,
            eventType: "ORDER_CANCELLED",
            orderId,
            customerId: result.rows[0].customer_id,
            reason,
            timestamp: event.timestamp.toISOString(),
            version: 1,
          }),
        ]
      );

      await projectOrderEvent(client, event);

      await client.query("COMMIT");
      logger.info("Order cancelled via event sourcing", { orderId, reason });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to cancel order", {
        error: (error as Error).message,
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
