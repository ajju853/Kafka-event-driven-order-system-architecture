import { Kafka } from "kafkajs";
import { EVENT_TOPICS } from "@kafka-order-system/shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { pool } from "../models/db";
import { projectEvent } from "./order-projector";

export async function startConsumer(): Promise<void> {
  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: [config.kafka.broker],
  });

  const consumer = kafka.consumer({ groupId: config.kafka.groupId });
  await consumer.connect();
  logger.info("Query service consumer connected to Kafka");

  const topics = Object.values(EVENT_TOPICS).filter((t) => t !== EVENT_TOPICS.DLQ_EVENTS && t !== EVENT_TOPICS.ORDER_DLQ);

  await consumer.subscribe({ topics, fromBeginning: true });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;

      const key = message.key?.toString();
      if (key && await isAlreadyProcessed(key)) {
        await consumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() },
        ]);
        return;
      }

      try {
        const event = JSON.parse(message.value.toString());
        const storedEvent = {
          id: event.eventId || key!,
          aggregateId: event.orderId || event.aggregateId || "",
          eventType: event.eventType || topic,
          version: event.version || 1,
          payload: event.payload || event,
          occurredAt: new Date(event.occurredAt || event.timestamp || Date.now()),
        };

        await projectEvent(storedEvent);
        await markProcessed(key!);

        await consumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() },
        ]);
      } catch (err) {
        logger.error("Failed to process Kafka message", {
          topic,
          partition,
          offset: message.offset,
          error: (err as Error).message,
        });
      }
    },
  });
}

async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM processed_events WHERE event_id = $1 AND consumer_group = $2`,
    [eventId, config.kafka.groupId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

async function markProcessed(eventId: string): Promise<void> {
  await pool.query(
    `INSERT INTO processed_events (event_id, consumer_group) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [eventId, config.kafka.groupId]
  );
}
