import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

export class OrderConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kafka = new Kafka({
      clientId: `${config.kafka.clientId}-consumer`,
      brokers: [config.kafka.broker],
    });
    this.consumer = this.kafka.consumer({
      groupId: "order-service-group",
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: ["payment-processed", "payment-failed", "inventory-failed"],
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => this.handleMessage(payload),
    });
    logger.info("Order consumer started (payment/inventory response listener)");
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    const rawValue = message.value?.toString();
    if (!rawValue) return;

    try {
      const event = JSON.parse(rawValue);
      const { orderId } = event.payload || {};

      if (!orderId) return;

      if (topic === "payment-processed") {
        await this.pool.query(
          "UPDATE orders SET status = 'PAYMENT_PROCESSED' WHERE id = $1",
          [orderId]
        );
        logger.info("Order status updated to PAYMENT_PROCESSED", { orderId });
      } else if (topic === "payment-failed") {
        await this.pool.query(
          "UPDATE orders SET status = 'PAYMENT_FAILED' WHERE id = $1",
          [orderId]
        );
        logger.warn("Order status updated to PAYMENT_FAILED", { orderId });
      } else if (topic === "inventory-failed") {
        await this.pool.query(
          "UPDATE orders SET status = 'INVENTORY_FAILED' WHERE id = $1",
          [orderId]
        );
        logger.warn("Order status updated to INVENTORY_FAILED", { orderId });
      }
    } catch (error) {
      logger.error("Error handling response event", {
        topic,
        error: (error as Error).message,
      });
    }
  }

  async shutdown(): Promise<void> {
    await this.consumer.disconnect();
  }
}
