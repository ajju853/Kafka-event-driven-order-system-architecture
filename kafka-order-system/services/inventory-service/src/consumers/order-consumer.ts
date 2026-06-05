import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { pool } from "../models/db";
import { redis, getInventoryCache, setInventoryCache } from "../config/redis";
import { logger } from "../utils/logger";
import {
  EVENT_TOPICS,
  CreateOrderEventSchema,
} from "@kafka-order-system/shared";

export class OrderConsumer {
  private consumer: Consumer;
  private running = false;

  constructor() {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.consumer = kafka.consumer({
      groupId: config.kafka.groupId,
      readUncommitted: false,
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: EVENT_TOPICS.ORDER_CREATED,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    this.running = true;
    logger.info("Order consumer started");
  }

  private async handleMessage({
    topic,
    partition,
    message,
  }: EachMessagePayload): Promise<void> {
    const eventId = message.key?.toString() || uuidv4();
    const startTime = Date.now();

    try {
      if (await this.isDuplicate(eventId)) {
        logger.debug("Skipping duplicate event", { eventId });
        return;
      }

      const eventData = JSON.parse(message.value!.toString());
      const event = CreateOrderEventSchema.parse(eventData);

      logger.info("Processing inventory reservation", {
        orderId: event.orderId,
      });

      await this.reserveInventory(event);

      await this.markProcessed(eventId);
      logger.info("Inventory reserved successfully", {
        orderId: event.orderId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Failed to process inventory event", {
        eventId,
        error: (error as Error).message,
        topic,
        partition,
        offset: message.offset,
      });
      await this.sendToDLQ(eventId, message, error as Error);
    }
  }

  private async reserveInventory(
    event: CreateOrderEvent
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const failedItems: Array<{
        productId: string;
        available: number;
        requested: number;
      }> = [];

      for (const item of event.items) {
        const result = await client.query(
          `SELECT quantity, version
           FROM inventory
           WHERE product_id = $1
           FOR UPDATE`,
          [item.productId]
        );

        if (result.rows.length === 0) {
          failedItems.push({
            productId: item.productId,
            available: 0,
            requested: item.quantity,
          });
          continue;
        }

        const row = result.rows[0];
        const availableQuantity = row.quantity - (row.reserved || 0);

        if (availableQuantity < item.quantity) {
          failedItems.push({
            productId: item.productId,
            available: availableQuantity,
            requested: item.quantity,
          });
          continue;
        }

        await client.query(
          `UPDATE inventory
           SET reserved = reserved + $1, version = version + 1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.productId]
        );

        await client.query(
          `INSERT INTO inventory_reservations (id, order_id, product_id, quantity, status)
           VALUES ($1, $2, $3, $4, 'RESERVED')`,
          [uuidv4(), event.orderId, item.productId, item.quantity]
        );

        await setInventoryCache(
          item.productId,
          availableQuantity - item.quantity
        );
      }

      if (failedItems.length > 0) {
        await client.query("ROLLBACK");

        logger.warn("Inventory reservation failed", {
          orderId: event.orderId,
          failedItems,
        });

        const kafka = new Kafka({
          clientId: "inventory-service",
          brokers: [config.kafka.broker],
        });
        const producer = kafka.producer();
        await producer.connect();
        await producer.send({
          topic: EVENT_TOPICS.INVENTORY_FAILED,
          messages: [
            {
              key: event.orderId,
              value: JSON.stringify({
                eventId: uuidv4(),
                eventType: "INVENTORY_FAILED",
                orderId: event.orderId,
                reason: "Insufficient stock",
                failedItems,
                timestamp: new Date().toISOString(),
                version: 1,
              }),
            },
          ],
        });
        await producer.disconnect();
        return;
      }

      await client.query("COMMIT");

      const kafka = new Kafka({
        clientId: "inventory-service",
        brokers: [config.kafka.broker],
      });
      const producer = kafka.producer();
      await producer.connect();
      await producer.send({
        topic: EVENT_TOPICS.INVENTORY_RESERVED,
        messages: [
          {
            key: event.orderId,
            value: JSON.stringify({
              eventId: uuidv4(),
              eventType: "INVENTORY_RESERVED",
              orderId: event.orderId,
              items: event.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                reserved: true,
              })),
              timestamp: new Date().toISOString(),
              version: 1,
            }),
          },
        ],
      });
      await producer.disconnect();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async isDuplicate(eventId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM processed_events
       WHERE event_id = $1 AND consumer_group = $2`,
      [eventId, config.kafka.groupId]
    );
    return result.rows.length > 0;
  }

  private async markProcessed(eventId: string): Promise<void> {
    await pool.query(
      `INSERT INTO processed_events (event_id, consumer_group)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, config.kafka.groupId]
    );
  }

  private async sendToDLQ(
    eventId: string,
    message: EachMessagePayload["message"],
    error: Error
  ): Promise<void> {
    try {
      const kafka = new Kafka({
        clientId: "inventory-service",
        brokers: [config.kafka.broker],
      });
      const producer = kafka.producer();
      await producer.connect();
      await producer.send({
        topic: EVENT_TOPICS.ORDER_DLQ,
        messages: [
          {
            key: eventId,
            value: JSON.stringify({
              originalEvent: JSON.parse(message.value!.toString()),
              error: error.message,
              failedAt: new Date().toISOString(),
              consumerGroup: config.kafka.groupId,
              topic: EVENT_TOPICS.ORDER_CREATED,
            }),
          },
        ],
      });
      await producer.disconnect();
      logger.warn("Event sent to DLQ", { eventId });
    } catch (dlqError) {
      logger.error("Failed to send to DLQ", {
        error: (dlqError as Error).message,
        eventId,
      });
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.consumer.disconnect();
    logger.info("Order consumer stopped");
  }
}
