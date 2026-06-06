import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "crypto";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import {
  CreateOrderRequest,
  OrderResponse,
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

  async getOrder(orderId: string): Promise<OrderResponse | null> {
    const result = await pool.query(
      `SELECT o.id, o.customer_id, o.status, o.total_amount,
              o.shipping_address, o.created_at, o.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price
                  )
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      customerId: row.customer_id,
      items: row.items,
      totalAmount: parseFloat(row.total_amount),
      status: row.status,
      shippingAddress: row.shipping_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listOrders(
    customerId?: string,
    status?: string,
    page = 1,
    limit = 20
  ): Promise<{ orders: OrderResponse[]; total: number }> {
    const conditions: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    if (customerId) {
      conditions.push(`o.customer_id = $${paramIndex++}`);
      params.push(customerId);
    }
    if (status) {
      conditions.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders o ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT o.id, o.customer_id, o.status, o.total_amount,
              o.shipping_address, o.created_at, o.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price
                  )
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit.toString(), offset.toString()]
    );

    const orders = result.rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      items: row.items,
      totalAmount: parseFloat(row.total_amount),
      status: row.status,
      shippingAddress: row.shipping_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { orders, total };
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
