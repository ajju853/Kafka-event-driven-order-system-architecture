import { pool } from "../models/db";
import { getProducer } from "./kafka-producer";
import { config } from "../config";
import { logger } from "../utils/logger";
import { EVENT_TOPICS } from "@kafka-order-system/shared";

export class OutboxPublisher {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    this.running = true;
    this.timer = setInterval(
      () => this.publishPending(),
      config.outbox.pollIntervalMs
    );
    logger.info("Outbox publisher started", {
      pollIntervalMs: config.outbox.pollIntervalMs,
    });
    await this.publishPending();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("Outbox publisher stopped");
  }

  private async publishPending(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: events } = await client.query(
        `SELECT id, event_type, payload, retry_count
         FROM outbox_events
         WHERE status = 'PENDING'
           AND (retry_count < $1 OR published_at IS NOT NULL)
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [config.retry.maxRetries, config.outbox.batchSize]
      );

      if (events.length === 0) {
        await client.query("COMMIT");
        return;
      }

      const producer = getProducer();

      for (const event of events) {
        try {
          const topic = event.event_type as keyof typeof EVENT_TOPICS;
          const kafkaTopic = EVENT_TOPICS[topic] || topic.toLowerCase();

          await producer.send({
            topic: kafkaTopic,
            messages: [
              {
                key: event.id,
                value: JSON.stringify(event.payload),
                headers: {
                  eventType: event.event_type,
                  version: "1",
                },
              },
            ],
          });

          await client.query(
            `UPDATE outbox_events
             SET status = 'PUBLISHED', published_at = NOW()
             WHERE id = $1`,
            [event.id]
          );

          logger.debug("Published outbox event to Kafka", {
            eventId: event.id,
            topic: kafkaTopic,
          });
        } catch (error) {
          await client.query(
            `UPDATE outbox_events
             SET retry_count = retry_count + 1
             WHERE id = $1`,
            [event.id]
          );

          if ((event.retry_count || 0) >= config.retry.maxRetries - 1) {
            await client.query(
              `UPDATE outbox_events
               SET status = 'FAILED'
               WHERE id = $1`,
              [event.id]
            );

            try {
              await producer.send({
                topic: EVENT_TOPICS.ORDER_DLQ,
                messages: [
                  {
                    key: event.id,
                    value: JSON.stringify({
                      ...event.payload,
                      _error: (error as Error).message,
                      _failedAt: new Date().toISOString(),
                    }),
                  },
                ],
              });
            } catch (dlqError) {
              logger.error("Failed to send to DLQ", {
                error: (dlqError as Error).message,
                eventId: event.id,
              });
            }
          }

          logger.error("Failed to publish outbox event", {
            eventId: event.id,
            error: (error as Error).message,
          });
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Outbox publisher batch failed", {
        error: (error as Error).message,
      });
    } finally {
      client.release();
    }
  }
}
