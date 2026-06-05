import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { EVENT_TOPICS } from "@kafka-order-system/shared";

export class AnalyticsConsumer {
  private consumer: Consumer;

  constructor() {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: { initialRetryTime: 300, retries: 10 },
    });
    this.consumer = kafka.consumer({
      groupId: config.kafka.groupId,
      readUncommitted: false,
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        EVENT_TOPICS.ORDER_CREATED,
        EVENT_TOPICS.ORDER_CANCELLED,
        EVENT_TOPICS.INVENTORY_RESERVED,
        EVENT_TOPICS.INVENTORY_FAILED,
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload) => this.handleMessage(payload),
    });

    logger.info("Analytics consumer started");
  }

  private async handleMessage({
    topic,
    message,
  }: EachMessagePayload): Promise<void> {
    const eventId = message.key?.toString() || uuidv4();
    try {
      if (await this.isDuplicate(eventId)) return;

      const event = JSON.parse(message.value!.toString());

      switch (topic) {
        case EVENT_TOPICS.ORDER_CREATED:
          await this.trackOrderCreated(event);
          break;
        case EVENT_TOPICS.ORDER_CANCELLED:
          await this.trackOrderCancelled(event);
          break;
        case EVENT_TOPICS.INVENTORY_RESERVED:
          await this.trackInventoryReserved(event);
          break;
        case EVENT_TOPICS.INVENTORY_FAILED:
          await this.trackInventoryFailed(event);
          break;
      }

      await this.markProcessed(eventId);
      logger.debug("Analytics event processed", { topic, eventId });
    } catch (error) {
      logger.error("Failed to process analytics event", {
        topic,
        eventId,
        error: (error as Error).message,
      });
    }
  }

  private async trackOrderCreated(event: any): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO order_metrics (id, order_id, customer_id, total_amount, item_count, status, event_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          event.orderId,
          event.customerId,
          event.totalAmount,
          event.items?.length || 0,
          "CREATED",
          "ORDER_CREATED",
          event.timestamp,
        ]
      );

      await client.query(
        `INSERT INTO daily_order_summary (date, total_orders, total_revenue, avg_order_value)
         VALUES ($1, 1, $2, $2)
         ON CONFLICT (date) DO UPDATE SET
           total_orders = daily_order_summary.total_orders + 1,
           total_revenue = daily_order_summary.total_revenue + $2,
           avg_order_value = (daily_order_summary.total_revenue + $2) / (daily_order_summary.total_orders + 1),
           updated_at = NOW()`,
        [
          event.timestamp.substring(0, 10),
          event.totalAmount,
        ]
      );
    } finally {
      client.release();
    }
  }

  private async trackOrderCancelled(event: any): Promise<void> {
    await pool.query(
      `UPDATE daily_order_summary
       SET cancelled_orders = cancelled_orders + 1, updated_at = NOW()
       WHERE date = $1`,
      [event.timestamp.substring(0, 10)]
    );
  }

  private async trackInventoryReserved(_event: any): Promise<void> {
    logger.debug("Inventory reservation tracked");
  }

  private async trackInventoryFailed(_event: any): Promise<void> {
    logger.warn("Inventory failure tracked");
  }

  private async isDuplicate(eventId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, config.kafka.groupId]
    );
    return result.rows.length > 0;
  }

  private async markProcessed(eventId: string): Promise<void> {
    await pool.query(
      `INSERT INTO processed_events (event_id, consumer_group)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, config.kafka.groupId]
    );
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    logger.info("Analytics consumer stopped");
  }
}
