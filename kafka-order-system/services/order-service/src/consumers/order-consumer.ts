import { randomUUID } from "crypto";
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";
import {
  buildPaymentProcessedEvent,
  buildPaymentFailedEvent,
  appendOrderEvent,
} from "../services/event-sourcing";
import { projectOrderEvent } from "../projections/order-projection";

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
      const payload = event.payload || event;
      const { orderId, customerId, paymentId, amount, errorMessage } = payload;

      if (!orderId) return;

      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");

        if (topic === "payment-processed") {
          const domainEvent = buildPaymentProcessedEvent(
            orderId,
            customerId || "unknown",
            paymentId || "unknown",
            amount || 0
          );
          await appendOrderEvent(domainEvent);
          await projectOrderEvent(client, domainEvent);
          logger.info("Payment processed event sourced", { orderId });

        } else if (topic === "payment-failed") {
          const domainEvent = buildPaymentFailedEvent(
            orderId,
            customerId || "unknown",
            paymentId || "unknown",
            amount || 0,
            errorMessage || "Payment failed"
          );
          await appendOrderEvent(domainEvent);
          await projectOrderEvent(client, domainEvent);
          logger.warn("Payment failed event sourced", { orderId, errorMessage });

        } else if (topic === "inventory-failed") {
          const domainEvent = {
            eventId: randomUUID(),
            aggregateId: orderId,
            aggregateType: "order",
            eventType: "InventoryFailed",
            version: 1,
            timestamp: new Date(),
            payload: { orderId, reason: payload.reason || "Inventory unavailable" },
          };
          await appendOrderEvent(domainEvent);
          await projectOrderEvent(client, domainEvent);
          logger.warn("Inventory failed event sourced", { orderId });
        }

        await client.query("COMMIT");
      } catch (innerError) {
        await client.query("ROLLBACK");
        throw innerError;
      } finally {
        client.release();
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
