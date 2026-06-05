import { Kafka, Producer } from "kafkajs";
import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

export class DLQReplayService {
  private pool: Pool;
  private kafka: Kafka;
  private producer: Producer;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
    });
    this.producer = this.kafka.producer();
  }

  async getEvents(limit = 50, offset = 0): Promise<{ events: unknown[]; total: number }> {
    const events = await this.pool.query(
      "SELECT * FROM dlq_events ORDER BY failed_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    const count = await this.pool.query("SELECT COUNT(*) FROM dlq_events");
    return {
      events: events.rows,
      total: parseInt(count.rows[0].count, 10),
    };
  }

  async getEvent(eventId: string): Promise<unknown | null> {
    const result = await this.pool.query(
      "SELECT * FROM dlq_events WHERE event_id = $1",
      [eventId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async replayEvent(eventId: string): Promise<{ success: boolean; targetTopic: string; error?: string }> {
    const result = await this.pool.query(
      "SELECT * FROM dlq_events WHERE event_id = $1",
      [eventId]
    );

    if (result.rows.length === 0) {
      return { success: false, targetTopic: "", error: "Event not found" };
    }

    const event = result.rows[0];
    const originalPayload = typeof event.original_payload === "string"
      ? event.original_payload
      : JSON.stringify(event.original_payload);

    const targetTopic = event.source_topic;

    try {
      if (!this.producer) {
        await this.producer.connect();
      }

      await this.producer.send({
        topic: targetTopic,
        messages: [
          {
            key: event.event_id,
            value: originalPayload,
          },
        ],
      });

      await this.pool.query(
        "UPDATE dlq_events SET replayed = true, replayed_at = NOW() WHERE event_id = $1",
        [eventId]
      );

      logger.info("DLQ event replayed", { eventId, targetTopic });
      return { success: true, targetTopic };
    } catch (error) {
      const msg = (error as Error).message;
      logger.error("Failed to replay DLQ event", { eventId, error: msg });
      return { success: false, targetTopic, error: msg };
    }
  }

  async shutdown(): Promise<void> {
    await this.producer?.disconnect();
  }
}
