import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

export class DLQConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
    });
    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "dlq-events", fromBeginning: true });
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });
    logger.info("DLQ consumer started");
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    const rawValue = message.value?.toString();
    if (!rawValue) return;

    try {
      const parsed = JSON.parse(rawValue);
      await this.pool.query(
        `INSERT INTO dlq_events (event_id, original_payload, error_message, consumer_group, source_topic, failed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          message.key?.toString() || `dlq_${Date.now()}`,
          parsed.originalEvent || rawValue,
          parsed.errorMessage || "Unknown error",
          parsed.consumerGroup || "unknown",
          parsed.topic || "unknown",
          parsed.failedAt || new Date().toISOString(),
        ]
      );
    } catch (error) {
      logger.error("Failed to store DLQ event", { error: (error as Error).message });
    }
  }

  async shutdown(): Promise<void> {
    await this.consumer.disconnect();
  }
}
