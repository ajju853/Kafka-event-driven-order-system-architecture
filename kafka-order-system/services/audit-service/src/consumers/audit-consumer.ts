import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { EVENT_TOPICS } from "@kafka-order-system/shared";

const ALL_TOPICS = Object.values(EVENT_TOPICS);

export class AuditConsumer {
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
      topics: ALL_TOPICS,
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: async (payload) => this.handleMessage(payload),
    });

    logger.info("Audit consumer started", { topics: ALL_TOPICS });
  }

  private async handleMessage({
    topic,
    partition,
    message,
  }: EachMessagePayload): Promise<void> {
    const eventId = message.key?.toString() || uuidv4();
    try {
      const event = JSON.parse(message.value!.toString());
      const eventType = event.eventType || topic;

      await pool.query(
        `INSERT INTO event_audit_log
         (id, event_id, event_type, aggregate_id, aggregate_type, payload, source_service, topic, partition, offset, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(),
          eventId,
          eventType,
          event.orderId || event.aggregateId,
          event.eventType?.startsWith("ORDER")
            ? "order"
            : event.eventType?.startsWith("INVENTORY")
            ? "inventory"
            : "unknown",
          JSON.stringify(event),
          event.sourceService || "unknown",
          topic,
          partition,
          message.offset,
          event.timestamp || new Date().toISOString(),
        ]
      );

      logger.debug("Audit log recorded", { eventId, eventType, topic });
    } catch (error) {
      logger.error("Failed to record audit log", {
        topic,
        partition,
        offset: message.offset,
        error: (error as Error).message,
      });
    }
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    logger.info("Audit consumer stopped");
  }
}
