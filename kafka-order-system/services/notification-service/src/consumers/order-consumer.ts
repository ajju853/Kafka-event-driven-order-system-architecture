import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendOrderConfirmation, sendOrderCancellation } from "../services/email-service";
import { sendOrderStatusNotification } from "../services/sms-service";
import { sendOrderPushNotification } from "../services/push-service";
import { EVENT_TOPICS } from "@kafka-order-system/shared";
import { notificationsSent } from "../metrics";

export class OrderEventConsumer {
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

    logger.info("Notification consumer started");
  }

  private async handleMessage({
    topic,
    message,
  }: EachMessagePayload): Promise<void> {
    try {
      const event = JSON.parse(message.value!.toString());

      switch (topic) {
        case EVENT_TOPICS.ORDER_CREATED:
          await Promise.all([
            sendOrderConfirmation(
              `${event.customerId}@example.com`,
              event.orderId,
              event.customerId
            ),
            sendOrderStatusNotification(
              "+1234567890",
              event.orderId,
              "CREATED"
            ),
            sendOrderPushNotification(
              event.customerId,
              event.orderId,
              "CREATED"
            ),
          ]);
          break;

        case EVENT_TOPICS.ORDER_CANCELLED:
          await Promise.all([
            sendOrderCancellation(
              `${event.customerId}@example.com`,
              event.orderId
            ),
            sendOrderPushNotification(
              event.customerId,
              event.orderId,
              "CANCELLED"
            ),
          ]);
          break;

        case EVENT_TOPICS.INVENTORY_RESERVED:
          await sendOrderPushNotification(
            event.customerId,
            event.orderId,
            "INVENTORY_RESERVED"
          );
          break;

        case EVENT_TOPICS.INVENTORY_FAILED:
          await sendOrderPushNotification(
            event.customerId,
            event.orderId,
            "OUT_OF_STOCK"
          );
          break;
      }

      notificationsSent.inc();
      logger.info("Notification sent", { topic, orderId: event.orderId });
    } catch (error) {
      logger.error("Failed to process notification event", {
        topic,
        error: (error as Error).message,
      });
    }
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    logger.info("Notification consumer stopped");
  }
}
