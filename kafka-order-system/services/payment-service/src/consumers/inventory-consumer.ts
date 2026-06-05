import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { OrderEvent } from "@kafka-order-system/shared";
import { config } from "../config";
import { pool } from "../models/db";
import { processPayment } from "../services/payment-processor";
import { logger } from "../utils/logger";

export class InventoryConsumer {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
    });

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 1000,
        retries: 5,
      },
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: "inventory-reserved",
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    logger.info("Inventory consumer started");
  }

  private async handleMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
    const eventId = message.key?.toString() || "unknown";
    const rawValue = message.value?.toString();

    if (!rawValue) {
      logger.warn("Empty message received", { eventId, topic, partition });
      return;
    }

    try {
      const event: OrderEvent = JSON.parse(rawValue);

      if (await this.isDuplicate(eventId)) {
        logger.info("Skipping duplicate event", { eventId });
        return;
      }

      if (event.type !== "ORDER_INVENTORY_RESERVED") {
        logger.debug("Ignoring non-inventory event", { eventType: event.type });
        return;
      }

      const { orderId, customerId, totalAmount } = event.payload;
      const paymentResult = await processPayment(orderId, customerId!, totalAmount);

      await this.markProcessed(eventId);

      const producer = this.kafka.producer();
      await producer.connect();

      try {
        if (paymentResult.status === "SUCCESS") {
          await producer.send({
            topic: "payment-processed",
            messages: [
              {
                key: eventId,
                value: JSON.stringify({
                  ...event,
                  type: "ORDER_PAYMENT_PROCESSED",
                  timestamp: new Date().toISOString(),
                  payload: {
                    ...event.payload,
                    transactionId: paymentResult.transactionId,
                    paymentStatus: "SUCCESS",
                  },
                }),
              },
            ],
          });
          logger.info("Payment processed event published", { orderId });
        } else {
          await producer.send({
            topic: "payment-failed",
            messages: [
              {
                key: eventId,
                value: JSON.stringify({
                  ...event,
                  type: "ORDER_PAYMENT_FAILED",
                  timestamp: new Date().toISOString(),
                  payload: {
                    ...event.payload,
                    transactionId: paymentResult.transactionId,
                    paymentStatus: "FAILED",
                    errorMessage: paymentResult.errorMessage,
                  },
                }),
              },
            ],
          });

          await producer.send({
            topic: "inventory-release",
            messages: [
              {
                key: eventId,
                value: JSON.stringify({
                  ...event,
                  type: "INVENTORY_RELEASE",
                  timestamp: new Date().toISOString(),
                  payload: event.payload,
                }),
              },
            ],
          });
          logger.warn("Payment failed; inventory release triggered", { orderId });
        }
      } finally {
        await producer.disconnect();
      }
    } catch (error) {
      logger.error("Error processing inventory-reserved event", {
        eventId,
        error: (error as Error).message,
      });

      await this.sendToDLQ(eventId, rawValue, (error as Error).message);
    }
  }

  private async isDuplicate(eventId: string): Promise<boolean> {
    const result = await pool.query(
      "SELECT 1 FROM processed_events WHERE event_id = $1",
      [eventId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  private async markProcessed(eventId: string): Promise<void> {
    await pool.query(
      "INSERT INTO processed_events (event_id, consumer_group) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING",
      [eventId, config.kafka.groupId]
    );
  }

  private async sendToDLQ(eventId: string, rawValue: string, errorMessage: string): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      try {
        await producer.send({
          topic: "dlq-events",
          messages: [
            {
              key: eventId,
              value: JSON.stringify({
                originalEvent: rawValue,
                errorMessage,
                failedAt: new Date().toISOString(),
                consumerGroup: config.kafka.groupId,
                topic: "inventory-reserved",
              }),
            },
          ],
        });
        logger.warn("Event sent to DLQ", { eventId });
      } finally {
        await producer.disconnect();
      }
    } catch (dlqError) {
      logger.error("Failed to send event to DLQ", {
        eventId,
        error: (dlqError as Error).message,
      });
    }
  }

  async shutdown(): Promise<void> {
    await this.consumer.disconnect();
    logger.info("Inventory consumer disconnected");
  }
}
